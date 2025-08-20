/* eslint-disable */
// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

const env = (k: string) => Deno.env.get(k) || '';

function bad(status: number, msg: string) {
  return new Response(JSON.stringify({ ok: false, error: msg }), { status, headers: cors });
}

function sb() {
  // cache client on globalThis
  const g: any = globalThis as any;
  if (g.__sb) return g.__sb;

  const url = env('SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !serviceKey) {
    const missing = [
      !url ? 'SUPABASE_URL' : null,
      !serviceKey ? 'SUPABASE_SERVICE_ROLE_KEY' : null,
    ].filter(Boolean).join(', ');
    throw new Error(`Missing required env: ${missing}`);
  }

  g.__sb = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return g.__sb;
}

async function replyWithAI(latestUser: string, conversationHistory: Array<{role: string, content: string}> = [], imageUrl?: string) {
  const apiKey = env('OPENAI_API_KEY');
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY');

  const systemPrompt = `You are a helpful property maintenance troubleshooting assistant. 

Key behaviors:
- Ask for the model of what's broken. If it's a specific model, ask for the model number. And then find the instructions manual.
- Be conversational and friendly, not just instructional
- Ask follow-up questions to better understand the problem
- Remember what was discussed previously in this conversation
- Ask for clarification when needed (e.g., "Can you describe what you hear when you try to turn it on?")
- Offer to escalate to a human agent if the issue seems complex
- Be concise but thorough
- When analyzing images, describe what you see and provide specific guidance

When appropriate, ask questions like:
- "When did this first start happening?"
- "Have you tried [specific step] yet?"
- "Can you send a photo of [specific thing]?"
- "Is there any unusual noise/smell/visible damage?"

Always prioritize safety and suggest professional help for electrical, gas, or structural issues.`;

  // Use GPT-4o (not mini) for vision capabilities
  const model = imageUrl ? 'gpt-5' : 'gpt-5-mini';
  
  const userMessage = imageUrl 
    ? {
        role: 'user' as const,
        content: [
          { type: 'text', text: latestUser },
          { type: 'image_url', image_url: { url: imageUrl } }
        ]
      }
    : { role: 'user' as const, content: latestUser };
   
  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      userMessage,
    ],
    temperature: 0.4,
  };

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text()}`);

  const j = await r.json();
  const fallback = "I'm here to help. Could you share a bit more?";
  return j.choices?.[0]?.message?.content ?? fallback;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return bad(405, 'Method not allowed');

  try {
    const { ticketId, messageText, imageUrl } = (await req.json()) as { ticketId?: string; messageText?: string; imageUrl?: string };
    if (!ticketId || !messageText) return bad(400, 'ticketId and messageText required');
    if (!UUID_RE.test(ticketId)) return bad(400, 'ticketId must be a UUID');

    const client = sb();

    const { data: t, error: te } = await client
      .from('tenant_tickets')
      .select('id, agency_id')
      .eq('id', ticketId)
      .single();

    if (te) return bad(404, `Ticket lookup failed: ${te.message}`);
    if (!t) return bad(404, 'Ticket not found');

    // Load conversation history for context
    const { data: messages, error: msgError } = await client
      .from('tenant_messages')
      .select('sender_id, body, is_system')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true })
      .limit(20); // Last 20 messages for context

    const conversationHistory: Array<{role: string, content: string}> = [];
    if (messages && !msgError) {
      for (const msg of messages) {
        if (msg.is_system) {
          conversationHistory.push({ role: 'assistant', content: msg.body });
        } else {
          conversationHistory.push({ role: 'user', content: msg.body });
        }
      }
    }

    let ai: string;
    try {
      ai = await replyWithAI(messageText, conversationHistory, imageUrl);
    } catch (oe: any) {
      console.error('OpenAI error', oe?.message ?? oe);
      ai = "I could not reach the AI right now. Please try again in a moment.";
    }

    const { error: me } = await client.from('tenant_messages').insert([{
      ticket_id: ticketId,
      agency_id: t.agency_id,
      sender_id: '1f2193dd-38b2-4f64-ab27-34f2f7145644', // Use a real user ID for FK constraint
      body: ai,
      is_system: true,
      meta: { model: 'gpt-4o-mini' },
    }]);

    if (me) return bad(500, `Insert failed: ${me.message}`);

    return new Response(JSON.stringify({ ok: true, reply: ai }), { status: 200, headers: cors });
  } catch (e: any) {
    console.error('Unhandled error', e?.message ?? e);
    return bad(500, e?.message || String(e));
  }
}

Deno.serve(handler);
