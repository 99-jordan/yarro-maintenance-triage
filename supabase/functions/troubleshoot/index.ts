/* eslint-disable */
// Supabase Edge Function: troubleshoot
// Minimal triage agent using OpenAI GPT-4.1-mini

// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface RequestBody {
  ticketId: string;
  tenantId?: string;
  messageText: string;
}

const getEnv = (name: string) => Deno.env.get(name) || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const SUPABASE_URL = getEnv('SUPABASE_URL');
const SERVICE_ROLE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});


const SYSTEM_PROMPT = `You are a property maintenance troubleshooting assistant.
Goals:
- Help the tenant or agent diagnose and resolve issues quickly.
- Classify the issue category and severity.
- Provide safe, step-by-step instructions.
- If professional help is required, recommend escalation.

Categories: plumbing, electrical, heating, appliance, structural, pest, general
Severity: low, normal, high, urgent

You can propose ACTIONS for the system to execute. Allowed actions and params:
- update_ticket_status: { "status": "open|in_progress|resolved|cancelled" }
- request_photos: { "prompt": string }
- escalate_to_agent: { "reason"?: string }
Every action MUST include a unique action_id string. Do not include assign_specialist.

Also maintain a running, concise summary of the conversation so far to help future turns.
Output JSON only with keys: reply, category, severity, next_actions, escalate, reason, summary_update, actions.
Example:
{"reply":"short helpful answer...","category":"plumbing","severity":"normal","next_actions":["turn off water valve", "take a clear photo of the leak"],"escalate":false,"reason":"simple fix likely","summary_update":"Tenant reports small leak under sink; advised to shut valve and share photo.","actions":[{"type":"request_photos","params":{"prompt":"Please share a clear photo of the leak and the valve."},"action_id":"req-photos-1"}]}`;

async function loadTicketContext(ticketId: string) {
  const { data: ticket, error: ticketError } = await supabase
    .from('tenant_tickets')
    .select('id, agency_id, tenant_id, property_id, landlord_id, agent_id, title, description, status, severity, created_at')
    .eq('id', ticketId)
    .single();

  if (ticketError || !ticket) throw new Error(`Ticket not found: ${ticketError?.message}`);

  const { data: msgs, error: msgError } = await supabase
    .from('tenant_messages')
    .select('sender_id, body, created_at, is_system')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })
    .limit(30);

  if (msgError) throw new Error(`Failed to fetch messages: ${msgError.message}`);

  return { ticket, messages: msgs || [] };
}

function toChatHistory(messages: Array<{ sender_id: string; body: string; created_at: string; is_system: boolean | null }>, tenantId: string | null, agentId: string | null) {
  const chat: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];
  for (const m of messages) {
    if (m.is_system) {
      chat.push({ role: 'assistant', content: m.body });
    } else if (tenantId && m.sender_id === tenantId) {
      chat.push({ role: 'user', content: m.body });
    } else if (agentId && m.sender_id === agentId) {
      chat.push({ role: 'user', content: m.body });
    } else {
      // Other participants (owners/other staff) treated as user role
      chat.push({ role: 'user', content: m.body });
    }
  }
  return chat;
}

async function callLLM(history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>, latestUser: string) {
  const messages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    ...history,
    { role: 'user' as const, content: latestUser }
  ];

  // Use Chat Completions for reliability
  const apiKey = getEnv('OPENAI_API_KEY');
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-5-mini',
      messages,
      temperature: 0.3,
      response_format: { type: 'json_object' }
    })
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`OpenAI error: ${resp.status} ${errText}`);
  }
  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content || '{}';
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = {
      reply: 'I will help troubleshoot this issue. Could you share more detail or a photo? ',
      category: 'general',
      severity: 'normal',
      next_actions: ['share a short video or photo', 'describe any noises, smells, or error codes'],
      escalate: false,
      reason: 'Fallback when parsing fails',
      summary_update: 'Assistant joined the conversation to help with troubleshooting.'
    };
  }
  return parsed as {
    reply: string;
    category: string;
    severity: string;
    next_actions: string[];
    escalate: boolean;
    reason: string;
    summary_update?: string;
    actions?: Array<{ type: 'update_ticket_status' | 'request_photos' | 'escalate_to_agent'; params?: Record<string, unknown>; action_id?: string }>;
  };
}

async function insertAiMessage(ticketId: string, agencyId: string, body: string, meta: Record<string, unknown>) {
  const { error } = await supabase
    .from('tenant_messages')
    .insert([{
      ticket_id: ticketId,
      agency_id: agencyId,
      sender_id: '00000000-0000-0000-0000-000000000000', // system placeholder
      body,
      is_system: true,
      meta
    }]);
  if (error) throw new Error(`Failed to insert AI message: ${error.message}`);
}

const ALLOWED_STATUSES = new Set(['open', 'in_progress', 'resolved', 'cancelled']);

async function hasProcessedAction(ticketId: string, actionId?: string) {
  try {
    if (!actionId) return false;
    const { count, error } = await supabase
      .from('tenant_messages')
      .select('id', { count: 'exact', head: true })
      .eq('ticket_id', ticketId)
      .contains('meta', { action_id: actionId });
    if (error) return false;
    return !!count && count > 0;
  } catch {
    return false;
  }
}

async function insertSystemActionMessage(ticketId: string, agencyId: string, text: string, actionMeta: Record<string, unknown>) {
  const { error } = await supabase
    .from('tenant_messages')
    .insert([{
      ticket_id: ticketId,
      agency_id: agencyId,
      sender_id: '00000000-0000-0000-0000-000000000000',
      body: text,
      is_system: true,
      meta: actionMeta
    }]);
  if (error) throw new Error(`Failed to insert action message: ${error.message}`);
}

async function executeActions(ticketId: string, agencyId: string, ai: { actions?: Array<{ type: string; params?: Record<string, unknown>; action_id?: string }> }) {
  if (!ai.actions || ai.actions.length === 0) return;

  const N8N_WEBHOOK_URL = Deno.env.get('N8N_WEBHOOK_URL') || '';

  for (const action of ai.actions) {
    const already = await hasProcessedAction(ticketId, action.action_id);
    if (already) continue;
    const baseMeta: Record<string, unknown> = {
      action_type: action.type,
      action_id: action.action_id,
      params: action.params || {}
    };

    if (action.type === 'update_ticket_status') {
      const status = String((action.params || {}).status || '').toLowerCase();
      if (!ALLOWED_STATUSES.has(status)) {
        await insertSystemActionMessage(ticketId, agencyId, `AI proposed invalid status '${status}'. Skipped.`, { ...baseMeta, outcome: 'skipped_invalid_status' });
        continue;
      }
      const { error: updErr } = await supabase
        .from('tenant_tickets')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', ticketId);
      if (updErr) {
        await insertSystemActionMessage(ticketId, agencyId, `Failed to update status: ${updErr.message}`, { ...baseMeta, outcome: 'failed', error: updErr.message });
        continue;
      }
      await insertSystemActionMessage(ticketId, agencyId, `Status updated to ${status} by assistant.`, { ...baseMeta, outcome: 'ok' });
    }

    if (action.type === 'request_photos') {
      const prompt = String((action.params || {}).prompt || 'Please share clear photos of the issue to assist diagnosis.');
      await insertSystemActionMessage(ticketId, agencyId, prompt, { ...baseMeta, outcome: 'ok' });
    }

    if (action.type === 'escalate_to_agent') {
      const reason = String((action.params || {}).reason || 'Escalation requested by assistant.');
      // Optional: notify workflow
      if (N8N_WEBHOOK_URL) {
        try {
          await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ type: 'maintenance_escalation', ticketId, reason })
          });
        } catch (_) {
          // ignore webhook errors; still post system message
        }
      }
      await insertSystemActionMessage(ticketId, agencyId, `Escalated to agent: ${reason}`, { ...baseMeta, outcome: 'ok' });
    }
  }
}

async function upsertConversationSummary(ticketId: string, agencyId: string, summaryUpdate?: string) {
  try {
    if (!summaryUpdate || summaryUpdate.trim().length === 0) return;
    // Fetch existing summary
    const { data: existing } = await supabase
      .from('ai_conversation_summaries')
      .select('summary_text')
      .eq('ticket_id', ticketId)
      .single();

    const combined = existing?.summary_text
      ? `${existing.summary_text}\n- ${summaryUpdate}`
      : summaryUpdate;

    if (existing) {
      const { error: updErr } = await supabase
        .from('ai_conversation_summaries')
        .update({
          summary_text: combined,
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('ticket_id', ticketId);
      if (updErr) console.warn('Summary update warning:', updErr.message);
    } else {
      const { error: insErr } = await supabase
        .from('ai_conversation_summaries')
        .insert([{
          ticket_id: ticketId,
          agency_id: agencyId,
          summary_text: combined,
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]);
      if (insErr) console.warn('Summary insert warning:', insErr.message);
    }
  } catch (e) {
    console.warn('Summary upsert skipped:', e);
  }
}

async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS' || req.method === 'HEAD') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });

  if (!OPENAI_API_KEY) return Response.json({ ok: false, error: 'OPENAI_API_KEY not set' }, { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  if (!SERVICE_ROLE_KEY) return Response.json({ ok: false, error: 'SERVICE_ROLE key not set' }, { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const body = (await req.json()) as RequestBody & { observeOnly?: boolean };
  const { ticketId, messageText, observeOnly } = body;
  if (!ticketId || !messageText) {
    return Response.json({ ok: false, error: 'ticketId and messageText are required' }, { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const { ticket, messages } = await loadTicketContext(ticketId);
    const history = toChatHistory(messages, ticket.tenant_id, ticket.agent_id);
    if (observeOnly) {
      // Observation mode: keep summary updated without replying
      // Simple heuristic: append a short line describing the new message
      const line = `New message at ${new Date().toISOString()}: ${messageText.substring(0, 160)}`;
      await upsertConversationSummary(ticket.id, ticket.agency_id, line);
    } else {
      const ai = await callLLM(history, messageText);
      const meta = {
        category: ai.category,
        severity: ai.severity,
        next_actions: ai.next_actions,
        escalate: ai.escalate,
        reason: ai.reason,
        summary_update: ai.summary_update
      } as Record<string, unknown>;
      await insertAiMessage(ticket.id, ticket.agency_id, ai.reply, meta);
      await upsertConversationSummary(ticket.id, ticket.agency_id, ai.summary_update);
      await executeActions(ticket.id, ticket.agency_id, ai);
    }

    return Response.json({ ok: true }, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return Response.json({ ok: false, error: e.message || String(e) }, { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}

Deno.serve(handler);


