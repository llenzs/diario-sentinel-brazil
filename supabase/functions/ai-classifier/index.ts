import { adminClient, getEnabledIntegration } from "../_shared/supabase.ts";
import { jsonResponse } from "../_shared/invoke.ts";

const CATEGORIES = [
  "licitacao",
  "nomeacao",
  "exoneracao",
  "processo",
  "multa",
  "homologacao",
  "outro",
] as const;
type Category = (typeof CATEGORIES)[number];

const SYSTEM_PROMPT = `Você é um analista de Diário Oficial brasileiro. Classifica trechos onde um termo monitorado foi encontrado.

Para cada match, decida:
- category: uma das categorias abaixo
- summary: 1-2 frases descrevendo o que aconteceu (sem repetir o trecho)
- confidence: 0.0 a 1.0 — sua certeza de que este match é relevante
- is_false_positive: true se o termo aparece de forma irrelevante (homônimo, contexto não relacionado, citação genérica), false caso contrário
- reason: 1 frase curta explicando POR QUE classificou desse jeito (será mostrada ao usuário)

Categorias:
- licitacao: pregão, dispensa, concorrência, edital, ata de registro de preços
- nomeacao: nomeação, designação, posse em cargo público
- exoneracao: exoneração, demissão, dispensa de cargo
- processo: ação judicial, decisão, sentença, intimação, citação
- multa: penalidade, multa, sanção administrativa
- homologacao: homologação de licitação ou ato administrativo
- outro: qualquer outro contexto

Use a "pista de contexto" do usuário (se fornecida) para diferenciar homônimos.
Retorne SOMENTE JSON válido no formato exato:
{"category":"...","summary":"...","confidence":0.0,"is_false_positive":false,"reason":"..."}`;

Deno.serve(async (req) => {
  let body: { match_ids?: string[]; limit?: number } = {};
  try {
    body = await req.json();
  } catch {
    // ignore
  }
  const explicitIds = body.match_ids ?? [];
  const limit = body.limit ?? 25;

  const supa = adminClient();
  try {
    const anthropic = await getEnabledIntegration("anthropic");
    const apiKey = anthropic.secrets.api_key;
    const cfg = anthropic.config as { model?: string; ab_model?: string; ab_ratio?: number };
    const primaryModel = cfg.model || "claude-haiku-4-5-20251001";
    const abModel = cfg.ab_model?.trim() || null;
    const abRatio = abModel ? Math.min(1, Math.max(0, Number(cfg.ab_ratio ?? 0.2))) : 0;
    if (!apiKey) throw new Error("anthropic: api_key (vault) ausente");

    let q = supa
      .from("matches")
      .select(
        "id, excerpt, terms!inner(label, pattern, match_type, context_hint), publications!inner(title, sources!inner(name, level))",
      )
      .is("ai_processed_at", null);
    if (explicitIds.length > 0) q = q.in("id", explicitIds);
    else q = q.limit(limit);

    const { data: pending, error } = await q;
    if (error) throw error;
    if (!pending || pending.length === 0) {
      return jsonResponse({ processed: 0 });
    }

    // Process in parallel chunks of 5 to balance throughput vs rate limits
    const CHUNK_SIZE = 5;
    let processed = 0;
    let errors = 0;

    for (let i = 0; i < pending.length; i += CHUNK_SIZE) {
      const chunk = pending.slice(i, i + CHUNK_SIZE);
      const results = await Promise.allSettled(
        chunk.map(async (m) => {
          const model = abModel && Math.random() < abRatio ? abModel : primaryModel;
          const term = (
            m as {
              terms: {
                label: string;
                pattern: string;
                match_type: string;
                context_hint: string | null;
              };
            }
          ).terms;
          const pub = (
            m as {
              publications: { title: string | null; sources: { name: string; level: string } };
            }
          ).publications;
          const userPrompt = buildUserPrompt({
            label: term.label,
            pattern: term.pattern,
            match_type: term.match_type,
            context_hint: term.context_hint,
            excerpt: (m as { excerpt: string }).excerpt,
            source_name: pub.sources.name,
            publication_title: pub.title,
          });

          const result = await callAnthropic(apiKey, model, userPrompt);

          await supa
            .from("matches")
            .update({
              ai_category: result.category,
              ai_summary: result.summary,
              ai_confidence: result.confidence,
              ai_decision_reason: result.reason,
              is_false_positive: result.is_false_positive,
              ai_model: model,
              ai_processed_at: new Date().toISOString(),
            })
            .eq("id", (m as { id: string }).id);
        }),
      );

      for (const r of results) {
        if (r.status === "fulfilled") processed++;
        else {
          errors++;
          console.error("ai-classifier error", r.reason);
        }
      }
    }

    return jsonResponse({ processed, errors, total: pending.length });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function buildUserPrompt(args: {
  label: string;
  pattern: string;
  match_type: string;
  context_hint: string | null;
  excerpt: string;
  source_name: string;
  publication_title: string | null;
}): string {
  return [
    `Termo monitorado: "${args.label}" (padrão: ${args.pattern}, tipo: ${args.match_type})`,
    args.context_hint ? `Pista do usuário: ${args.context_hint}` : null,
    `Fonte: ${args.source_name}${args.publication_title ? ` — ${args.publication_title}` : ""}`,
    `Trecho do diário:\n"""\n${args.excerpt}\n"""`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function callAnthropic(
  apiKey: string,
  model: string,
  userPrompt: string,
): Promise<{
  category: Category;
  summary: string;
  confidence: number;
  is_false_positive: boolean;
  reason: string;
}> {
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
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Anthropic ${r.status}: ${text.slice(0, 200)}`);
  }
  const json = await r.json();
  const text = json.content?.[0]?.text ?? "";
  const parsed = JSON.parse(extractJson(text));
  const category = CATEGORIES.includes(parsed.category) ? parsed.category : "outro";
  return {
    category,
    summary: String(parsed.summary ?? "").slice(0, 500),
    confidence: clamp(Number(parsed.confidence ?? 0), 0, 1),
    is_false_positive: Boolean(parsed.is_false_positive ?? false),
    reason: String(parsed.reason ?? "").slice(0, 300),
  };
}

function extractJson(s: string): string {
  const m = s.match(/\{[\s\S]*\}/);
  return m ? m[0] : s;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, isFinite(n) ? n : 0));
}
