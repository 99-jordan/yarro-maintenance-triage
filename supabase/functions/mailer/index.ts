// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("", { headers: cors });
  try {
    const body = await req.json();
    const { to, subject, html } = body;
    const disabled = Deno.env.get("MAILER_DISABLED") === "true";
    if (disabled) return new Response(JSON.stringify({ ok: true, mocked: true }), { headers: cors });
    const key = Deno.env.get("RESEND_API_KEY")!;
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "Yarro <noreply@yourdomain>", to, subject, html }),
    });
    if (!resp.ok) throw new Error(await resp.text());
    return new Response(JSON.stringify({ ok: true }), { headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: cors });
  }
});


