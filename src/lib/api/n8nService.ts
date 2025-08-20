export type AiAction = {
  type: 'update_ticket_status' | 'request_photos' | 'escalate_to_agent';
  params?: Record<string, unknown>;
  action_id?: string;
};

export type AiResponse = {
  ok: boolean;
  reply?: string;
  error?: string;
  category?: string;
  severity?: string;
  next_actions?: string[];
  escalate?: boolean;
  reason?: string;
  summary_update?: string;
  actions?: AiAction[];
};

export async function aiChat(params: { ticketId: string; tenantId?: string; messageText: string }): Promise<AiResponse> {
  const url = import.meta.env.VITE_N8N_AI_WEBHOOK_URL as string;
  if (!url) throw new Error('VITE_N8N_AI_WEBHOOK_URL not set');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = (await res.json()) as AiResponse;
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || `AI webhook error (${res.status})`);
  }
  return data;
}


