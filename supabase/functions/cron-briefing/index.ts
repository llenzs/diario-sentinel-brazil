import { adminClient, getEnabledIntegration } from "../_shared/supabase.ts";
import { jsonResponse } from "../_shared/invoke.ts";

/**
 * Briefing automático diário/semanal via WhatsApp (Evolution).
 * Iterates over users with notify_whatsapp=true e phone_e164 preenchido,
 * gera briefing IA dos últimos N dias e envia.
 *
 * Body: { window_days?: 1|7 (default 1), force?: boolean }
 */
Deno.serve(async (req) => {
  let body: { window_days?: number; force?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // ignore
  }
  const windowDays = body.window_days === 7 ? 7 : 1;

  const supa = adminClient();
  try {
    // Carrega Anthropic + Evolution
    const anthropic = await getEnabledIntegration("anthropic");
    const evolution = await getEnabledIntegration("evolution");
    const apiKey = anthropic.secrets.api_key;
    const model = (anthropic.config as { model?: string }).model || "claude-haiku-4-5-20251001";
    if (!apiKey) throw new Error("Anthropic api_key missing");
    const evoCfg = evolution.config as { base_url?: string; instance?: string };
    const evoKey = evolution.secrets.api_key;
    if (!evoCfg.base_url || !evoCfg.instance || !evoKey) {
      throw new Error("Evolution config incompleta");
    }

    // Lista users com WhatsApp ativo
    const { data: profiles, error: pErr } = await supa
      .from("profiles")
      .select("id, display_name, phone_e164")
      .eq("notify_whatsapp", true)
      .not("phone_e164", "is", null);
    if (pErr) throw pErr;

    const since = new Date(Date.now() - windowDays * 86400_000).toISOString();
    const sent: Array<{ user_id: string; phone: string; status: string; error?: string }> = [];

    for (const p of profiles ?? []) {
      try {
        const { data: matches } = await supa
          .from("matches")
          .select(
            "ai_category, ai_summary, terms(label), publications(publication_date, sources(name))",
          )
          .eq("user_id", p.id)
          .eq("is_false_positive", false)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(30);

        if (!matches || matches.length === 0) {
          // Mensagem zero apenas pro briefing semanal
          if (windowDays === 7) {
            await sendWhatsapp(
              evoCfg as { base_url: string; instance: string },
              evoKey,
              p.phone_e164!,
              `📭 Briefing semanal\n\nNenhum alerta confirmado nos últimos 7 dias para seus termos cadastrados.\n\n_Continue assim, o radar tá ligado._`,
            );
            sent.push({ user_id: p.id, phone: p.phone_e164!, status: "no_matches_weekly" });
          }
          continue;
        }

        // Gera briefing
        const briefing = await generateBriefing(apiKey, model, matches, windowDays);
        const message = formatBriefing(briefing, matches.length, windowDays);

        await sendWhatsapp(
          evoCfg as { base_url: string; instance: string },
          evoKey,
          p.phone_e164!,
          message,
        );
        sent.push({ user_id: p.id, phone: p.phone_e164!, status: "sent" });
      } catch (e) {
        sent.push({
          user_id: p.id,
          phone: p.phone_e164 ?? "",
          status: "failed",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return jsonResponse({ ok: true, window_days: windowDays, total: sent.length, sent });
  } catch (e) {
    return jsonResponse({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

async function generateBriefing(
  apiKey: string,
  model: string,
  matches: unknown[],
  windowDays: number,
): Promise<string> {
  const summary = matches
    .map((m, i) => {
      const row = m as {
        ai_category: string | null;
        ai_summary: string | null;
        terms: { label: string } | null;
        publications: { publication_date: string; sources: { name: string } | null } | null;
      };
      return `${i + 1}. [${row.ai_category ?? "outro"}] "${row.terms?.label}" — ${row.publications?.sources?.name ?? ""} (${row.publications?.publication_date ?? ""}): ${row.ai_summary ?? ""}`;
    })
    .join("\n");

  const periodo = windowDays === 1 ? "as últimas 24 horas" : "os últimos 7 dias";

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 400,
      system: [
        {
          type: "text",
          text: "Você é um analista de Diário Oficial. Escreva um briefing CURTO (max 800 caracteres) em português brasileiro para envio por WhatsApp. Use parágrafos curtos. Sem listas numeradas. Sem emojis exceto 1 no início. Tom: direto, profissional. Estrutura: contexto numérico + destaque do período + recomendação de atenção.",
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Briefing dos alertas de ${periodo} (${matches.length} no total):\n\n${summary}`,
        },
      ],
    }),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Anthropic ${r.status}: ${text.slice(0, 200)}`);
  }
  const json = await r.json();
  return (json.content?.[0]?.text ?? "").trim();
}

function formatBriefing(briefing: string, count: number, windowDays: number): string {
  const titulo = windowDays === 1 ? "*Briefing diário*" : "*Briefing semanal*";
  const linhaCount = `${count} alerta${count === 1 ? "" : "s"} no período`;
  return `${titulo}\n${linhaCount}\n\n${briefing}\n\n_Diário Oficial Scanner_`;
}

async function sendWhatsapp(
  cfg: { base_url: string; instance: string },
  apiKey: string,
  phone: string,
  text: string,
) {
  const number = phone.replace(/\D/g, "");
  const url = `${cfg.base_url.replace(/\/$/, "")}/message/sendText/${encodeURIComponent(cfg.instance)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { apikey: apiKey, "content-type": "application/json" },
    body: JSON.stringify({ number, text }),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Evolution ${r.status}: ${err.slice(0, 200)}`);
  }
}
