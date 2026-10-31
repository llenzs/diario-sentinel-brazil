import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export function adminClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type IntegrationFull = {
  enabled: boolean;
  config: Record<string, unknown>;
  secrets: Record<string, string>;
};

/**
 * Returns enabled flag + jsonb config (non-secret fields) + secrets (Vault-decrypted).
 * Use this in edge functions instead of reading integration_configs directly.
 *
 * `config` carries: anthropic.model, inlabs.email, evolution.base_url, evolution.instance, resend.from_email
 * `secrets` carries: anthropic.api_key, inlabs.password, firecrawl.api_key, evolution.api_key, resend.api_key
 */
export async function getIntegration(provider: string): Promise<IntegrationFull> {
  const supa = adminClient();
  const { data: cfgRow, error: cfgErr } = await supa
    .from("integration_configs")
    .select("enabled, config")
    .eq("provider", provider)
    .maybeSingle();
  if (cfgErr) throw cfgErr;
  if (!cfgRow) throw new Error(`Integration not found: ${provider}`);

  // Read secrets via secured RPC backed by Vault (decrypted_secrets view).
  // Note: PostgREST exposes only public schema, so we expose a public wrapper.
  let secrets: Record<string, string> = {};
  const { data: secretsData, error: secretsErr } = await supa.rpc(
    "_internal_get_integration_secrets" as never,
    { _provider: provider } as never,
  );
  if (!secretsErr && secretsData) {
    secrets = secretsData as Record<string, string>;
  }

  return {
    enabled: cfgRow.enabled,
    config: (cfgRow.config as Record<string, unknown>) ?? {},
    secrets,
  };
}

export async function getEnabledIntegration(provider: string): Promise<IntegrationFull> {
  const row = await getIntegration(provider);
  if (!row.enabled) {
    throw new Error(`Integration ${provider} is disabled`);
  }
  return row;
}

export async function markIntegrationTest(provider: string, ok: boolean, error: string | null) {
  const supa = adminClient();
  await supa
    .from("integration_configs")
    .update({
      last_tested_at: new Date().toISOString(),
      last_test_ok: ok,
      last_test_error: error,
    })
    .eq("provider", provider);
}
