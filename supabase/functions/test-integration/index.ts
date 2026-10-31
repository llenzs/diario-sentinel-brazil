import { corsHeaders, preflight } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { getIntegration, markIntegrationTest } from "../_shared/supabase.ts";

type Provider = "anthropic" | "firecrawl" | "evolution" | "resend" | "inlabs";

/**
 * Tests an integration. The body can contain `inline` values when the user
 * is in the onboarding wizard and hasn't saved yet — in that case we test
 * against the inline values rather than the stored ones.
 */
Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    await requireAdmin(req);
    const body = await req.json();
    const provider = body.provider as Provider;
    if (!provider) {
      return json({ ok: false, error: "provider required" }, 400);
    }
    const inline = (body.inline ?? null) as {
      config?: Record<string, string>;
      secrets?: Record<string, string>;
    } | null;

    let merged: Record<string, string>;
    if (inline) {
      merged = { ...(inline.config ?? {}), ...(inline.secrets ?? {}) };
    } else {
      const row = await getIntegration(provider);
      merged = {
        ...(row.config as Record<string, string>),
        ...(row.secrets as Record<string, string>),
      };
    }

    const result = await runTest(provider, merged);
    if (!inline) {
      // only persist test result when testing the stored config
      await markIntegrationTest(provider, result.ok, result.ok ? null : result.error);
    }
    return json(result);
  } catch (e) {
    if (e instanceof Response) return e;
    const message = e instanceof Error ? e.message : String(e);
    return json({ ok: false, error: message }, 500);
  }
});

async function runTest(
  provider: Provider,
  c: Record<string, string>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    switch (provider) {
      case "anthropic":
        return await testAnthropic(c);
      case "firecrawl":
        return await testFirecrawl(c);
      case "evolution":
        return await testEvolution(c);
      case "resend":
        return await testResend(c);
      case "inlabs":
        return await testInlabs(c);
      default:
        return { ok: false, error: `Unknown provider: ${provider}` };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function testAnthropic(c: Record<string, string>) {
  if (!c.api_key) return { ok: false as const, error: "api_key faltando" };
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": c.api_key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: c.model || "claude-haiku-4-5-20251001",
      max_tokens: 8,
      messages: [{ role: "user", content: "ok" }],
    }),
  });
  if (!r.ok) {
    const text = await r.text();
    return { ok: false as const, error: `${r.status}: ${text.slice(0, 200)}` };
  }
  return { ok: true as const };
}

async function testFirecrawl(c: Record<string, string>) {
  if (!c.api_key) return { ok: false as const, error: "api_key faltando" };
  const r = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${c.api_key}`, "content-type": "application/json" },
    body: JSON.stringify({ url: "https://example.com", formats: ["markdown"] }),
  });
  if (!r.ok) {
    const text = await r.text();
    return { ok: false as const, error: `${r.status}: ${text.slice(0, 200)}` };
  }
  return { ok: true as const };
}

async function testEvolution(c: Record<string, string>) {
  if (!c.base_url || !c.api_key || !c.instance) {
    return { ok: false as const, error: "base_url, api_key e instance são obrigatórios" };
  }
  const url = `${c.base_url.replace(/\/$/, "")}/instance/connectionState/${encodeURIComponent(c.instance)}`;
  const r = await fetch(url, { headers: { apikey: c.api_key } });
  if (!r.ok) {
    const text = await r.text();
    return { ok: false as const, error: `${r.status}: ${text.slice(0, 200)}` };
  }
  return { ok: true as const };
}

async function testResend(c: Record<string, string>) {
  if (!c.api_key) return { ok: false as const, error: "api_key faltando" };
  const r = await fetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${c.api_key}` },
  });
  if (!r.ok) {
    const text = await r.text();
    return { ok: false as const, error: `${r.status}: ${text.slice(0, 200)}` };
  }
  return { ok: true as const };
}

async function testInlabs(c: Record<string, string>) {
  if (!c.email || !c.password) {
    return { ok: false as const, error: "email e password obrigatórios" };
  }
  // INLabs returns 302 → index.php em login OK; 200 com form refeito quando falha.
  // Não usamos redirect: "manual" porque no Deno isso vira opaqueredirect
  // (status 0, headers vazios) — perdemos o set-cookie.
  const r = await fetch("https://inlabs.in.gov.br/logar.php", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email: c.email, password: c.password }),
    redirect: "follow",
  });
  // Após follow, response.url contém o destino final
  if (r.url.includes("logar.php")) {
    // login form re-shown = falha
    return { ok: false as const, error: "credenciais inválidas (login form re-exibido)" };
  }
  if (r.status >= 200 && r.status < 400) return { ok: true as const };
  return { ok: false as const, error: `INLabs login retornou ${r.status}` };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
