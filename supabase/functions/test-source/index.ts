import { corsHeaders, preflight } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { adminClient, getEnabledIntegration } from "../_shared/supabase.ts";

/**
 * Testa uma source rodando o adapter dela (com override opcional de URL/mode)
 * e retorna um preview do conteúdo + heurística de "parece conteúdo de verdade".
 *
 * Body: { source_id, override_url?, override_mode? }
 * Returns: { ok, content_length, preview, looks_like_content, mode_used, error? }
 */
Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    await requireAdmin(req);
    const body = await req.json();
    const sourceId: string | undefined = body.source_id;
    const overrideUrl: string | undefined = body.override_url;
    const overrideMode: string | undefined = body.override_mode;

    if (!sourceId) return json({ ok: false, error: "source_id required" }, 400);

    const supa = adminClient();
    const { data: src, error: sErr } = await supa
      .from("sources")
      .select("code, name, scraper_adapter, adapter_config")
      .eq("id", sourceId)
      .single();
    if (sErr || !src) return json({ ok: false, error: "source not found" }, 404);

    const cfg = (src.adapter_config ?? {}) as { url?: string; mode?: string };
    const url = overrideUrl?.trim() || cfg.url;
    const mode = overrideMode || cfg.mode || "scrape";

    if (src.scraper_adapter !== "firecrawl") {
      return json({
        ok: false,
        error: `Test só está implementado para adapter Firecrawl. Adapter atual: ${src.scraper_adapter}`,
      });
    }
    if (!url) {
      return json({ ok: false, error: "URL ausente (adapter_config.url ou override_url)" });
    }

    const fc = await getEnabledIntegration("firecrawl");
    const apiKey = fc.secrets.api_key;
    if (!apiKey) return json({ ok: false, error: "Firecrawl não configurada" });

    const r = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
    });
    if (!r.ok) {
      const text = await r.text();
      return json({
        ok: false,
        error: `Firecrawl ${r.status}: ${text.slice(0, 200)}`,
        mode_used: mode,
      });
    }
    const data = await r.json();
    const markdown: string = (data?.data?.markdown ?? "").trim();
    const contentLength = markdown.length;

    const looksLikeContent = detectsRealContent(markdown);

    return json({
      ok: true,
      content_length: contentLength,
      preview: markdown.slice(0, 600),
      looks_like_content: looksLikeContent.ok,
      hint: looksLikeContent.hint,
      mode_used: mode,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

/**
 * Heurística: o markdown retornado parece um conteúdo real de Diário Oficial?
 *
 * Detectores positivos:
 * - palavras como PORTARIA, RESOLUÇÃO, DECRETO, ATO, EDITAL, INSTRUÇÃO NORMATIVA
 * - "Art." (artigo)
 * - "Edição N" ou "Edição Nº"
 * - data brasileira (DD/MM/YYYY)
 * - "DIÁRIO OFICIAL DO ESTADO" no corpo
 *
 * Detectores negativos:
 * - markdown muito curto (<500 chars) provavelmente é menu/header
 * - presença majoritária de links de navegação ("Home", "Sobre", "Contato")
 */
function detectsRealContent(md: string): { ok: boolean; hint: string } {
  if (!md || md.length < 300) {
    return { ok: false, hint: "Conteúdo retornado é muito curto — provavelmente é só o menu/header da home, não a edição do dia." };
  }

  const positive = [
    /PORTARIA\s+N[°º]?/i,
    /RESOLUÇÃO\s+N[°º]?/i,
    /DECRETO\s+N[°º]?/i,
    /\bEDITAL\b/i,
    /INSTRUÇÃO\s+NORMATIVA/i,
    /\bArt\.\s*\d+/i,
    /Edição\s+N[°º]?\s*\d+/i,
    /\d{2}\/\d{2}\/20\d{2}/,
    /DIÁRIO\s+OFICIAL\s+(DO\s+)?ESTADO/i,
  ];
  const positiveHits = positive.filter((re) => re.test(md)).length;

  const navLinks = (md.match(/\[(Home|Sobre|Contato|Notícias|Serviços|Acesso à informação)\]/gi) || []).length;
  const totalLinks = (md.match(/\[.+?\]\(.+?\)/g) || []).length;
  const linkRatio = totalLinks > 0 ? navLinks / totalLinks : 0;

  if (positiveHits >= 2) {
    return { ok: true, hint: `Encontramos ${positiveHits} indicadores de conteúdo oficial (portaria/decreto/etc).` };
  }
  if (linkRatio > 0.3 && positiveHits === 0) {
    return {
      ok: false,
      hint: "A página retornada parece ser o menu de navegação do portal, não a edição. Tente colar o link direto pra 'Edição do dia' ou 'Diário Oficial — última edição'.",
    };
  }
  if (positiveHits === 0) {
    return {
      ok: false,
      hint: "Conteúdo retornado, mas sem indicadores típicos de DO (PORTARIA, DECRETO, etc). Pode ser uma página de listagem ou cadastro.",
    };
  }
  return { ok: true, hint: `${positiveHits} indicador(es) encontrado(s) — provavelmente é conteúdo OK.` };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
