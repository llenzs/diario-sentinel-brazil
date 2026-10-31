import { corsHeaders, preflight } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { getIntegration } from "../_shared/supabase.ts";

/**
 * Cria (ou recupera, se já existe) uma instância Evolution e retorna o QR code
 * pra parear com WhatsApp.
 *
 * Body: { base_url, api_key, instance_name? }  (default name = "diario-scanner")
 * Returns: { instance, qr_base64, pairing_code? }
 */
const DEFAULT_INSTANCE = "diario-scanner";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    let baseUrl: string | undefined = body.base_url;
    let apiKey: string | undefined = body.api_key;
    const instanceName: string = body.instance_name?.trim() || DEFAULT_INSTANCE;

    // Fall back to saved config/secrets if not provided in the body
    if (!baseUrl || !apiKey) {
      try {
        const saved = await getIntegration("evolution");
        if (!baseUrl) baseUrl = (saved.config.base_url as string | undefined) ?? undefined;
        if (!apiKey) apiKey = saved.secrets.api_key ?? undefined;
      } catch (_) {
        // ignore — will fail validation below
      }
    }

    if (!baseUrl || !apiKey) {
      return json({ ok: false, error: "base_url e api_key obrigatórios" }, 400);
    }

    const trimmedBase = baseUrl.replace(/\/$/, "");

    // 1) Try to create the instance
    const createRes = await fetch(`${trimmedBase}/instance/create`, {
      method: "POST",
      headers: { apikey: apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
      }),
    });

    let payload: EvolutionCreateResponse | null = null;
    if (createRes.ok || createRes.status === 201) {
      payload = (await createRes.json()) as EvolutionCreateResponse;
    } else {
      const errText = await createRes.text();
      // Common: 403/409 when instance already exists. Try /connect to fetch QR.
      const isAlreadyExists =
        createRes.status === 403 ||
        createRes.status === 409 ||
        errText.toLowerCase().includes("already") ||
        errText.toLowerCase().includes("exists");

      if (!isAlreadyExists) {
        return json(
          { ok: false, error: `Evolution /create ${createRes.status}: ${errText.slice(0, 200)}` },
          400,
        );
      }

      // 2) instance already exists — fetch current QR via /connect
      const connectRes = await fetch(
        `${trimmedBase}/instance/connect/${encodeURIComponent(instanceName)}`,
        { headers: { apikey: apiKey } },
      );
      if (!connectRes.ok) {
        const t = await connectRes.text();
        return json(
          { ok: false, error: `Evolution /connect ${connectRes.status}: ${t.slice(0, 200)}` },
          400,
        );
      }
      payload = (await connectRes.json()) as EvolutionCreateResponse;
    }

    const qrBase64 = extractQr(payload);
    const pairingCode = extractPairingCode(payload);

    if (!qrBase64 && !pairingCode) {
      // already connected, perhaps
      return json({
        ok: true,
        instance: instanceName,
        qr_base64: null,
        pairing_code: null,
        already_connected: true,
      });
    }

    return json({
      ok: true,
      instance: instanceName,
      qr_base64: qrBase64,
      pairing_code: pairingCode,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

type EvolutionCreateResponse = {
  qrcode?: { base64?: string; code?: string; pairingCode?: string };
  pairingCode?: string;
  instance?: { instanceName?: string };
};

function extractQr(p: EvolutionCreateResponse | null): string | null {
  if (!p) return null;
  return p.qrcode?.base64 ?? null;
}

function extractPairingCode(p: EvolutionCreateResponse | null): string | null {
  if (!p) return null;
  return p.qrcode?.pairingCode ?? p.pairingCode ?? null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
