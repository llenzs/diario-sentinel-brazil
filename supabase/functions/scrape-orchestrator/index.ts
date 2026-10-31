import { adminClient } from "../_shared/supabase.ts";
import { jsonResponse } from "../_shared/invoke.ts";
import { preflight } from "../_shared/cors.ts";

/**
 * Orchestrator: para cada source habilitada, garante uma scrape_run para hoje
 * em status='pending'. Trigger `trg_fire_adapter` dispatcha o adapter real.
 *
 * Body opcional:
 *   { force?: boolean, date?: string }  -> se force=true, reseta runs de hoje (mesmo success) pra pending.
 *                                         date="YYYY-MM-DD" para outro dia (padrão=hoje).
 */
Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const body = await req.json().catch(() => ({}));
    const force = body?.force === true;

    const supa = adminClient();
    const date: string = typeof body?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
      ? body.date
      : new Date().toISOString().slice(0, 10);

    const { data: sources, error } = await supa
      .from("sources")
      .select("id, code, scraper_adapter")
      .eq("enabled", true);
    if (error) throw error;

    const results: Array<{ source: string; action: string; error?: string }> = [];

    for (const source of sources ?? []) {
      const { data: existing } = await supa
        .from("scrape_runs")
        .select("id, status")
        .eq("source_id", source.id)
        .eq("publication_date", date)
        .maybeSingle();

      if (!force && existing && (existing.status === "success" || existing.status === "running")) {
        results.push({ source: source.code, action: `skipped:${existing.status}` });
        continue;
      }

      const { error: upsertErr } = await supa.from("scrape_runs").upsert(
        {
          source_id: source.id,
          publication_date: date,
          status: "pending",
          started_at: null,
          finished_at: null,
          error: null,
          pages_processed: 0,
        },
        { onConflict: "source_id,publication_date" },
      );
      if (upsertErr) {
        results.push({ source: source.code, action: "error", error: upsertErr.message });
      } else {
        results.push({ source: source.code, action: force ? "forced" : "enqueued" });
      }
    }

    const enqueued = results.filter((r) => r.action === "enqueued" || r.action === "forced").length;
    const skipped = results.filter((r) => r.action.startsWith("skipped")).length;
    const failed = results.filter((r) => r.action === "error").length;

    return jsonResponse({
      date,
      total: sources?.length ?? 0,
      enqueued,
      skipped,
      failed,
      force,
      results,
    });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
