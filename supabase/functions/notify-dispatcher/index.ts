import { adminClient, getEnabledIntegration } from "../_shared/supabase.ts";
import { jsonResponse } from "../_shared/invoke.ts";

const MAX_ATTEMPTS = 5;

Deno.serve(async (req) => {
  let body: { limit?: number } = {};
  try {
    body = await req.json();
  } catch {
    // ignore
  }
  const limit = body.limit ?? 50;

  const supa = adminClient();
  try {
    const { data: pending, error } = await supa
      .from("notifications")
      .select(
        "id, channel, attempts, match_id, user_id, matches!inner(ai_summary, ai_category, terms!inner(label), publications!inner(publication_date, url, sources!inner(name)))",
      )
      .eq("status", "queued")
      .lt("attempts", MAX_ATTEMPTS)
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) throw error;
    if (!pending || pending.length === 0) {
      return jsonResponse({ sent: 0 });
    }

    const userIds = Array.from(new Set(pending.map((n) => n.user_id)));
    const { data: profiles, error: pErr } = await supa
      .from("profiles")
      .select("id, phone_e164")
      .in("id", userIds);
    if (pErr) throw pErr;
    const phoneByUser = new Map((profiles ?? []).map((p) => [p.id, p.phone_e164 ?? null]));

    const { data: users } = await supa.auth.admin.listUsers({ perPage: 1000 });
    const emailByUser = new Map((users?.users ?? []).map((u) => [u.id, u.email ?? null]));

    let evolution: Awaited<ReturnType<typeof getEnabledIntegration>> | null = null;
    let resend: Awaited<ReturnType<typeof getEnabledIntegration>> | null = null;

    let sent = 0;
    let failed = 0;
    for (const n of pending) {
      try {
        const match = (n as typeof n & { matches: MatchJoin }).matches;
        const messageText = renderMessage(match);
        if (n.channel === "whatsapp") {
          evolution ??= await getEnabledIntegration("evolution");
          const phone = phoneByUser.get(n.user_id);
          if (!phone) throw new Error("usuário sem telefone cadastrado");
          await sendWhatsapp(buildEvolutionCfg(evolution), phone, messageText);
        } else if (n.channel === "email") {
          resend ??= await getEnabledIntegration("resend");
          const email = emailByUser.get(n.user_id);
          if (!email) throw new Error("usuário sem e-mail");
          await sendEmail(buildResendCfg(resend), email, match, messageText);
        }
        await supa
          .from("notifications")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            attempts: (n.attempts ?? 0) + 1,
            error: null,
          })
          .eq("id", n.id);
        sent++;
      } catch (e) {
        failed++;
        const attempts = (n.attempts ?? 0) + 1;
        const status = attempts >= MAX_ATTEMPTS ? "dlq" : "queued";
        await supa
          .from("notifications")
          .update({
            status,
            attempts,
            error: e instanceof Error ? e.message : String(e),
          })
          .eq("id", n.id);
      }
    }

    return jsonResponse({ sent, failed, total: pending.length });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

type MatchJoin = {
  ai_summary: string | null;
  ai_category: string | null;
  terms: { label: string };
  publications: {
    publication_date: string;
    url: string | null;
    sources: { name: string };
  };
};

type EvolutionCfg = { base_url: string; api_key: string; instance: string };
type ResendCfg = { api_key: string; from_email: string };

function buildEvolutionCfg(i: Awaited<ReturnType<typeof getEnabledIntegration>>): EvolutionCfg {
  const c = i.config as { base_url?: string; instance?: string };
  const api_key = i.secrets.api_key;
  if (!c.base_url || !c.instance || !api_key) {
    throw new Error("evolution config incompleto (base_url/instance/api_key)");
  }
  return { base_url: c.base_url, instance: c.instance, api_key };
}

function buildResendCfg(i: Awaited<ReturnType<typeof getEnabledIntegration>>): ResendCfg {
  const c = i.config as { from_email?: string };
  const api_key = i.secrets.api_key;
  if (!c.from_email || !api_key) {
    throw new Error("resend config incompleto (from_email/api_key)");
  }
  return { api_key, from_email: c.from_email };
}

function renderMessage(m: MatchJoin): string {
  const lines = [
    `🔔 *${m.terms.label}* foi citado`,
    `📰 ${m.publications.sources.name} — ${m.publications.publication_date}`,
  ];
  if (m.ai_category) lines.push(`🏷️ ${m.ai_category}`);
  if (m.ai_summary) lines.push("", m.ai_summary);
  if (m.publications.url) lines.push("", `🔗 ${m.publications.url}`);
  return lines.join("\n");
}

async function sendWhatsapp(cfg: EvolutionCfg, phone: string, text: string) {
  const number = phone.replace(/\D/g, "");
  const url = `${cfg.base_url.replace(/\/$/, "")}/message/sendText/${encodeURIComponent(cfg.instance)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { apikey: cfg.api_key, "content-type": "application/json" },
    body: JSON.stringify({ number, text }),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Evolution ${r.status}: ${err.slice(0, 200)}`);
  }
}

async function sendEmail(cfg: ResendCfg, to: string, m: MatchJoin, text: string) {
  const html = `
    <div style="font-family:system-ui;padding:16px;max-width:560px">
      <h2 style="margin:0 0 8px">${escapeHtml(m.terms.label)} — ${escapeHtml(m.publications.sources.name)}</h2>
      <p style="color:#666;margin:0 0 12px">${m.publications.publication_date}${m.ai_category ? ` · ${m.ai_category}` : ""}</p>
      ${m.ai_summary ? `<p>${escapeHtml(m.ai_summary)}</p>` : ""}
      ${m.publications.url ? `<p><a href="${m.publications.url}">Ler na fonte oficial →</a></p>` : ""}
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
      <pre style="color:#999;font-size:11px;white-space:pre-wrap">${escapeHtml(text)}</pre>
    </div>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.api_key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: cfg.from_email,
      to,
      subject: `🔔 ${m.terms.label} — ${m.publications.sources.name}`,
      html,
      text,
    }),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Resend ${r.status}: ${err.slice(0, 200)}`);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
