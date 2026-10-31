import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";

/**
 * Lê SUPABASE_URL + SUPABASE_ANON_KEY do env do projeto (Lovable Cloud popula),
 * derivam o functions_url, ativam o pipeline.
 * O admin só clica "Ativar" — não precisa colar nada.
 */
Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    await requireAdmin(req);

    const body = await req.json().catch(() => ({}) as { anon_key?: string });
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const envAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!supabaseUrl) {
      return json({ ok: false, error: "env SUPABASE_URL indisponível" }, 500);
    }

    // Pg_cron/gateway only accept legacy JWT (eyJ...). The new sb_publishable_*
    // format is rejected with UNAUTHORIZED_INVALID_JWT_FORMAT.
    // Preference: caller-provided > env (only if it's a JWT).
    const callerAnon = (body as { anon_key?: string }).anon_key;
    const isJwt = (k: string) => k.startsWith("eyJ") && k.split(".").length === 3;

    let anonKey: string;
    if (callerAnon && isJwt(callerAnon)) {
      anonKey = callerAnon;
    } else if (isJwt(envAnonKey)) {
      anonKey = envAnonKey;
    } else {
      return json(
        {
          ok: false,
          error:
            "Anon key disponível não é um JWT legacy (eyJ...). Forneça `anon_key` no body — pegue de Lovable Cloud Config / publishable_key.",
        },
        400,
      );
    }

    const functionsUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1`;

    // Use a user-scoped client so auth.uid() resolves inside the SECURITY DEFINER RPC
    const authHeader = req.headers.get("Authorization") ?? "";
    const supa = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error } = await supa.rpc(
      "admin_apply_runtime" as never,
      {
        _functions_url: functionsUrl,
        _anon_key: anonKey,
        _cron_enabled: true,
      } as never,
    );
    if (error) {
      console.error("admin_apply_runtime RPC failed:", JSON.stringify(error));
      throw new Error(error.message ?? JSON.stringify(error));
    }

    // Smoke-test: chama o orchestrator pra validar que tá entregando
    const smoke = await fetch(`${functionsUrl}/scrape-orchestrator`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
        "content-type": "application/json",
      },
      body: "{}",
    });
    const smokeOk = smoke.ok;

    return json({
      ok: true,
      functions_url: functionsUrl,
      cron_enabled: true,
      smoke_test: smokeOk ? "passed" : `http_${smoke.status}`,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("bootstrap-runtime error:", e);
    const msg =
      e instanceof Error
        ? e.message
        : typeof e === "string"
          ? e
          : JSON.stringify(e, Object.getOwnPropertyNames(e as object));
    return json({ ok: false, error: msg }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
