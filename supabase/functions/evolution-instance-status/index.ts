import { corsHeaders, preflight } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { getIntegration } from "../_shared/supabase.ts";

/**
 * Checa o estado de conexão de uma instância Evolution.
 * Body: { base_url, api_key, instance }
 * Returns: { ok, state: "open" | "connecting" | "close" }
 */
Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    let baseUrl: string | undefined = body.base_url;
    let apiKey: string | undefined = body.api_key;
    let instance: string | undefined = body.instance;

    if (!baseUrl || !apiKey || !instance) {
      try {
        const saved = await getIntegration("evolution");
        if (!baseUrl) baseUrl = (saved.config.base_url as string | undefined) ?? undefined;
        if (!instance) instance = (saved.config.instance as string | undefined) ?? undefined;
        if (!apiKey) apiKey = saved.secrets.api_key ?? undefined;
      } catch (_) {
        // ignore
      }
    }

    if (!baseUrl || !apiKey || !instance) {
      return json({ ok: false, error: "base_url, api_key e instance obrigatórios" }, 400);
    }

    const r = await fetch(
      `${baseUrl.replace(/\/$/, "")}/instance/connectionState/${encodeURIComponent(instance)}`,
      { headers: { apikey: apiKey } },
    );
    if (!r.ok) {
      const t = await r.text();
      return json({ ok: false, error: `Evolution ${r.status}: ${t.slice(0, 200)}` }, 400);
    }
    const data = (await r.json()) as { instance?: { state?: string }; state?: string };
    const state = data?.instance?.state ?? data?.state ?? "close";
    return json({ ok: true, state });
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
