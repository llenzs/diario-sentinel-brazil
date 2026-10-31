import { corsHeaders, preflight } from "../_shared/cors.ts";
import { getEnabledIntegration } from "../_shared/supabase.ts";
import { jsonResponse } from "../_shared/invoke.ts";

/**
 * Recebe { label, context_hint? } e retorna sugestões de variações + match_type.
 * Útil pra capturar homônimos, abreviações, formato CNPJ etc.
 *
 * Body: { label: string, context_hint?: string }
 * Returns: { suggestions: Array<{pattern, match_type, reason}> }
 */
Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (!req.headers.get("Authorization")?.startsWith("Bearer ")) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  try {
    const body = await req.json();
    const label: string = (body.label ?? "").trim();
    const contextHint: string | undefined = body.context_hint;
    if (!label) return jsonResponse({ error: "label required" }, 400);

    const anthropic = await getEnabledIntegration("anthropic");
    const apiKey = anthropic.secrets.api_key;
    const model = (anthropic.config as { model?: string }).model || "claude-haiku-4-5-20251001";
    if (!apiKey) {
      return jsonResponse({ error: "Anthropic disabled" }, 503);
    }

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 600,
        system: [
          {
            type: "text",
            text: 'Você ajuda a configurar termos de busca em Diários Oficiais brasileiros. Recebe um rótulo e (opcional) contexto, retorna 3-5 sugestões de padrões pra capturar variações comuns sem aumentar falsos positivos.\n\nFormatos suportados:\n- literal: string exata (case-insensitive)\n- regex: regex JavaScript (use com cuidado)\n- cnpj: 14 dígitos (formato livre)\n\nPra nomes: gere variações com sobrenome abreviado, sobrenome primeiro, com/sem títulos.\nPra empresas: gere razão social completa, nome fantasia, variações de pontuação.\nPra CNPJ: detecte se o label é um CNPJ e retorne só com match_type=cnpj.\n\nRetorne SOMENTE JSON:\n{"suggestions":[{"pattern":"...","match_type":"literal|regex|cnpj","reason":"..."}, ...]}',
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content: `Rótulo: "${label}"${contextHint ? `\nContexto: ${contextHint}` : ""}`,
          },
        ],
      }),
    });
    if (!r.ok) {
      const text = await r.text();
      throw new Error(`Anthropic ${r.status}: ${text.slice(0, 200)}`);
    }
    const json = await r.json();
    const text = json.content?.[0]?.text ?? "";
    const parsed = JSON.parse(extractJson(text));
    return jsonResponse({ suggestions: parsed.suggestions ?? [] });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function extractJson(s: string): string {
  const m = s.match(/\{[\s\S]*\}/);
  return m ? m[0] : s;
}
