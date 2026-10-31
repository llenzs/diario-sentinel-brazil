import { adminClient } from "../_shared/supabase.ts";
import { jsonResponse } from "../_shared/invoke.ts";

Deno.serve(async (_req) => {
  const supa = adminClient();
  const checks: Record<string, unknown> = {};
  try {
    const { count: srcCount } = await supa
      .from("sources")
      .select("*", { count: "exact", head: true })
      .eq("enabled", true);
    checks.sources_enabled = srcCount ?? 0;

    const { data: lastRun } = await supa
      .from("scrape_runs")
      .select("publication_date, status, finished_at")
      .order("finished_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    checks.last_scrape = lastRun ?? null;

    const { count: pendingMatches } = await supa
      .from("matches")
      .select("*", { count: "exact", head: true })
      .is("ai_processed_at", null);
    checks.matches_pending_ai = pendingMatches ?? 0;

    const { count: queuedNotifs } = await supa
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("status", "queued");
    checks.notifications_queued = queuedNotifs ?? 0;

    const { count: dlqNotifs } = await supa
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("status", "dlq");
    checks.notifications_dlq = dlqNotifs ?? 0;

    const { data: integrations } = await supa
      .from("integration_status")
      .select("provider, enabled, last_test_ok");
    checks.integrations = integrations ?? [];

    return jsonResponse({ status: "ok", checks, ts: new Date().toISOString() });
  } catch (e) {
    return jsonResponse(
      { status: "degraded", error: e instanceof Error ? e.message : String(e) },
      503,
    );
  }
});
