// schema v2: partitioned by publication_date
import { adminClient, getEnabledIntegration } from "../_shared/supabase.ts";
import { jsonResponse, sha256Hex } from "../_shared/invoke.ts";

/**
 * Generic Firecrawl adapter — for state diários without a native API.
 *
 * Reads adapter_config from sources row:
 *   { url: string }                                 — single page scrape
 *   { url: string, mode: "crawl", limit?: number }  — crawl multiple pages from a starting URL
 *   { url: string, mode: "extract", schema: object } — extract structured data via /extract
 */
Deno.serve(async (req) => {
  let payload: { source_id?: string; source_code?: string; date?: string } = {};
  try {
    payload = await req.json();
  } catch {
    // ignore
  }
  const { source_id, source_code, date } = payload;
  if (!source_id || !date) {
    return jsonResponse({ error: "source_id, date required" }, 400);
  }

  const supa = adminClient();
  await markRun(supa, source_id, date, "running");

  try {
    const fc = await getEnabledIntegration("firecrawl");
    const apiKey = fc.secrets.api_key;
    if (!apiKey) throw new Error("firecrawl: api_key (vault) ausente");

    const { data: srcRow, error: sErr } = await supa
      .from("sources")
      .select("adapter_config")
      .eq("id", source_id)
      .single();
    if (sErr) throw sErr;

    const cfg = (srcRow.adapter_config ?? {}) as AdapterCfg;
    if (!cfg.url) {
      throw new Error(`adapter_config.url ausente em ${source_code}`);
    }
    const mode = cfg.mode ?? "scrape";

    let inserted = 0;
    if (mode === "scrape") {
      inserted = await runScrape(supa, source_id, date, cfg.url, apiKey);
    } else if (mode === "crawl") {
      inserted = await runCrawl(supa, source_id, date, cfg.url, cfg.limit ?? 5, apiKey);
    } else if (mode === "extract" && cfg.schema) {
      inserted = await runExtract(supa, source_id, date, cfg.url, cfg.schema, apiKey);
    } else {
      throw new Error(`mode "${mode}" inválido ou schema ausente`);
    }

    await markRun(supa, source_id, date, "success", null, inserted);
    return jsonResponse({ source_code, mode, inserted });
  } catch (e) {
    const msg = e instanceof Error ? e.message : ((e as { message?: string })?.message ?? JSON.stringify(e));
    await markRun(supa, source_id, date, "failed", msg);
    return jsonResponse({ error: msg }, 500);
  }
});

type AdapterCfg = {
  url?: string;
  mode?: "scrape" | "crawl" | "extract";
  limit?: number;
  schema?: Record<string, unknown>;
};

async function runScrape(
  supa: ReturnType<typeof adminClient>,
  source_id: string,
  date: string,
  url: string,
  apiKey: string,
): Promise<number> {
  const r = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Firecrawl /scrape ${r.status}: ${text.slice(0, 200)}`);
  }
  const json = await r.json();
  const markdown: string = json?.data?.markdown ?? "";
  const title: string | undefined = json?.data?.metadata?.title;
  if (!markdown || markdown.length < 50) {
    throw new Error("Firecrawl retornou conteúdo vazio");
  }
  return await upsertPublication(supa, source_id, date, url, title ?? null, markdown);
}

async function runCrawl(
  supa: ReturnType<typeof adminClient>,
  source_id: string,
  date: string,
  url: string,
  limit: number,
  apiKey: string,
): Promise<number> {
  const r = await fetch("https://api.firecrawl.dev/v1/crawl", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      url,
      limit,
      scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
    }),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Firecrawl /crawl ${r.status}: ${text.slice(0, 200)}`);
  }
  const job = await r.json();
  const jobId: string = job?.id;
  if (!jobId) throw new Error("Firecrawl /crawl não retornou job id");

  // Poll job (max 60s)
  let pages: Array<{ markdown?: string; metadata?: { title?: string; sourceURL?: string } }> = [];
  for (let i = 0; i < 12; i++) {
    await sleep(5000);
    const sr = await fetch(`https://api.firecrawl.dev/v1/crawl/${jobId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!sr.ok) continue;
    const sj = await sr.json();
    if (sj?.status === "completed") {
      pages = sj?.data ?? [];
      break;
    }
  }
  let count = 0;
  for (const p of pages) {
    const md = p?.markdown ?? "";
    if (!md || md.length < 50) continue;
    const purl = p?.metadata?.sourceURL ?? url;
    count += await upsertPublication(supa, source_id, date, purl, p?.metadata?.title ?? null, md);
  }
  return count;
}

async function runExtract(
  supa: ReturnType<typeof adminClient>,
  source_id: string,
  date: string,
  url: string,
  schema: Record<string, unknown>,
  apiKey: string,
): Promise<number> {
  const r = await fetch("https://api.firecrawl.dev/v1/extract", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ urls: [url], schema }),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Firecrawl /extract ${r.status}: ${text.slice(0, 200)}`);
  }
  const json = await r.json();
  const data = json?.data;
  if (!data) throw new Error("Firecrawl /extract não retornou data");
  const text = JSON.stringify(data, null, 2);
  return await upsertPublication(supa, source_id, date, url, "Extração estruturada", text);
}

async function upsertPublication(
  supa: ReturnType<typeof adminClient>,
  source_id: string,
  date: string,
  url: string,
  title: string | null,
  text: string,
): Promise<number> {
  const hash = await sha256Hex(text);
  const { data: ins, error } = await supa
    .from("publications")
    .upsert(
      {
        source_id,
        publication_date: date,
        title,
        url,
        content_hash: hash,
        raw_text: text,
      },
      { onConflict: "source_id,content_hash,publication_date", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return ins?.id ? 1 : 0;
}

async function markRun(
  supa: ReturnType<typeof adminClient>,
  source_id: string,
  date: string,
  status: "running" | "success" | "failed",
  error: string | null = null,
  pages_processed = 0,
) {
  const now = new Date().toISOString();
  await supa.from("scrape_runs").upsert(
    {
      source_id,
      publication_date: date,
      status,
      error,
      pages_processed,
      started_at: status === "running" ? now : undefined,
      finished_at: status === "running" ? null : now,
    },
    { onConflict: "source_id,publication_date" },
  );
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}
