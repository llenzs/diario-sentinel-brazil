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

const SYSTEM_PROMPT = `Você é um analista de Diário Oficial brasileiro. Retorne SOMENTE JSON: {"category":"...","summary":"...","confidence":0.0,"is_false_positive":false,"reason":"..."}. Categorias: licitacao, nomeacao, exoneracao, processo, multa, homologacao, outro.`;

Deno.serve(async (_req) => {
  const supa = adminClient();
  try {
    const anthropic = await getEnabledIntegration("anthropic");
    const apiKey = anthropic.secrets.api_key;
    const model = (anthropic.config as { model?: string }).model || "claude-haiku-4-5-20251001";
    if (!apiKey) throw new Error("anthropic: api_key (vault) ausente");

    const { data: samples, error } = await supa.from("eval_dataset").select("*");
    if (error) throw error;
    if (!samples?.length) {
      return jsonResponse({ error: "eval_dataset vazio" }, 400);
    }

    const byCategory: Record<string, { tp: number; fp: number; fn: number }> = {};
    let correct = 0;
    let fpCorrect = 0;
    let fpTotal = 0;

    for (const s of samples) {
      const prompt = `Termo: "${s.source_term_label}"\n${s.source_context_hint ? `Contexto: ${s.source_context_hint}\n` : ""}Trecho:\n${s.source_excerpt}`;
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: 200,
          system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!r.ok) continue;
      const json = await r.json();
      const text = json.content?.[0]?.text ?? "";
      let parsed: { category?: string; is_false_positive?: boolean } = {};
      try {
        parsed = JSON.parse(extractJson(text));
      } catch {
        continue;
      }
      const predCat = CATEGORIES.includes(parsed.category as never)
        ? (parsed.category as string)
        : "outro";
      const predFp = Boolean(parsed.is_false_positive);
      const expCat = s.expected_category as string;
      const expFp = s.expected_is_false_positive as boolean;

      if (predCat === expCat) correct++;
      if (predFp === expFp) fpCorrect++;
      fpTotal++;

      if (!byCategory[expCat]) byCategory[expCat] = { tp: 0, fp: 0, fn: 0 };
      if (predCat === expCat) byCategory[expCat].tp++;
      else {
        byCategory[expCat].fn++;
        if (!byCategory[predCat]) byCategory[predCat] = { tp: 0, fp: 0, fn: 0 };
        byCategory[predCat].fp++;
      }
    }

    const total = samples.length;
    const precision = (correct / total) * 100;
    const fpAccuracy = fpTotal > 0 ? (fpCorrect / fpTotal) * 100 : 0;

    await supa.from("eval_runs").insert({
      model,
      total,
      precision_pct: precision.toFixed(2),
      recall_pct: precision.toFixed(2),
      fp_rate_pct: (100 - fpAccuracy).toFixed(2),
      by_category: byCategory,
    });

    return jsonResponse({
      total,
      precision_pct: precision,
      fp_accuracy_pct: fpAccuracy,
      by_category: byCategory,
    });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function extractJson(s: string): string {
  const m = s.match(/\{[\s\S]*\}/);
  return m ? m[0] : s;
}
