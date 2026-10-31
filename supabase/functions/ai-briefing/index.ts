import { preflight } from "../_shared/cors.ts";
import { adminClient, getEnabledIntegration } from "../_shared/supabase.ts";
import { jsonResponse } from "../_shared/invoke.ts";

/**
 * Gera um briefing executivo dos últimos 7 dias de matches do usuário.
 * Usa Anthropic Haiku com prompt cacheado.
 *
 * Auth: lê user_id do JWT (sub claim). JWT é validado pelo gateway (verify_jwt=true).
 * Fallback: aceita user_id no body se chamado server-to-server com service role.
 */
Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const body = await req.json().catch(() => ({}));
    let userId: string | null = body?.user_id ?? null;

    if (!userId) {
      const authHeader = req.headers.get("Authorization") ?? "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
      userId = decodeJwtSub(token);
    }

    if (!userId) {
      return jsonResponse({ error: "unauthorized: no user_id in JWT or body" }, 401);
    }

    const since = new Date(Date.now() - 7 * 86400_000).toISOString();
    const supa = adminClient();
    const { data: matches, error } = await supa
      .from("matches")
      .select(
        "ai_category, ai_summary, terms(label), publications(publication_date, sources(name))",
      )
      .eq("user_id", userId)
      .eq("is_false_positive", false)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;

    if (!matches || matches.length === 0) {
      return jsonResponse({
        briefing:
          "Nenhum alerta confirmado nos últimos 7 dias. Quando o pipeline encontrar matches dos seus termos, eles vão aparecer aqui resumidos.",
        match_count: 0,
      });
    }

    const anthropic = await getEnabledIntegration("anthropic").catch(() => null);
    const apiKey = anthropic?.secrets.api_key;
    const model =
      (anthropic?.config as { model?: string } | undefined)?.model || "claude-haiku-4-5-20251001";
    if (!apiKey) {
      return jsonResponse({
        briefing: `Você teve ${matches.length} alerta(s) na semana. Configure a Anthropic para receber resumos executivos automáticos.`,
        match_count: matches.length,
      });
    }

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

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 500,
        system: [
          {
            type: "text",
            text: "Você é um analista de Diário Oficial. Escreva um briefing executivo CURTO (no máximo 4 parágrafos) em português brasileiro a partir de uma lista de alertas dos últimos 7 dias. Estrutura: (1) números do período, (2) destaque principal, (3) tendências/categorias, (4) o que o usuário deve prestar atenção. Tom: direto, profissional, sem floreio. Sem listas — use frases.",
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content: `Briefing dos alertas (${matches.length} no total):\n\n${summary}`,
          },
        ],
      }),
    });
    if (!r.ok) {
      const text = await r.text();
      throw new Error(`Anthropic ${r.status}: ${text.slice(0, 200)}`);
    }
    const json = await r.json();
    const briefing = json.content?.[0]?.text ?? "";

    return jsonResponse({ briefing, match_count: matches.length });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

/**
 * Decode JWT sem verificação (gateway já verificou a assinatura).
 * Retorna o `sub` claim (= user_id) ou null se token inválido.
 */
function decodeJwtSub(token: string): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload?.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
