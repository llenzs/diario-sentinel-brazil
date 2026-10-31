// schema v2: partitioned by publication_date
import { adminClient } from "../_shared/supabase.ts";
import { jsonResponse, sha256Hex } from "../_shared/invoke.ts";

/**
 * Querido Diário adapter — uses public REST API at https://queridodiario.ok.org.br/api
 * Reads adapter_config.ibge from the source row.
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
    const { data: srcRow, error: sErr } = await supa
      .from("sources")
      .select("adapter_config")
      .eq("id", source_id)
      .single();
    if (sErr) throw sErr;
    const ibgeCode = (srcRow.adapter_config as { ibge?: string })?.ibge ?? null;
    if (!ibgeCode) {
      throw new Error(`adapter_config.ibge ausente em ${source_code}`);
    }

    const url = new URL("https://api.queridodiario.ok.org.br/gazettes");
    url.searchParams.set("territory_ids", ibgeCode);
    url.searchParams.set("published_since", date);
    url.searchParams.set("published_until", date);
    url.searchParams.set("size", "100");

    const r = await fetch(url.toString());
    if (!r.ok) {
      const text = await r.text();
      throw new Error(`QD API ${r.status}: ${text.slice(0, 200)}`);
    }
    const json = await r.json();
    const gazettes: Array<{
      territory_id: string;
      date: string;
      url: string;
      txt_url?: string;
      edition_number?: string;
    }> = json.gazettes ?? [];

    const insertedIds: string[] = [];
    for (const g of gazettes) {
      let text = "";
      if (g.txt_url) {
        const tr = await fetch(g.txt_url);
        if (tr.ok) text = await tr.text();
      }
      if (!text) text = `${g.url}\n${g.edition_number ?? ""}`;
      const hash = await sha256Hex(text);

      const { data: ins, error } = await supa
        .from("publications")
        .upsert(
          {
            source_id,
            publication_date: date,
            external_id: g.edition_number ?? null,
            title: g.edition_number ? `Edição ${g.edition_number}` : null,
            url: g.url,
            content_hash: hash,
            raw_text: text,
          },
          { onConflict: "source_id,content_hash,publication_date", ignoreDuplicates: true },
        )
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (ins?.id) insertedIds.push(ins.id);
    }

    await markRun(supa, source_id, date, "success", null, gazettes.length);

    // The publications insert trigger handles match extraction automatically.

    return jsonResponse({ source_code, inserted: insertedIds.length, found: gazettes.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : ((e as { message?: string })?.message ?? JSON.stringify(e));
    await markRun(supa, source_id, date, "failed", msg);
    return jsonResponse({ error: msg }, 500);
  }
});

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
