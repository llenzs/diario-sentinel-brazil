import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EvolutionEditDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [qr, setQr] = useState<{
    instance: string;
    qr_base64: string | null;
    pairing_code: string | null;
  } | null>(null);
  const [state, setState] = useState<"close" | "connecting" | "open" | null>(null);

  const existing = useQuery({
    queryKey: ["provider-edit", "evolution", open],
    enabled: open,
    queryFn: async () => {
      const [{ data: configRow }, { data: secretRows }] = await Promise.all([
        supabase
          .from("integration_configs")
          .select("config, enabled")
          .eq("provider", "evolution")
          .maybeSingle(),
        supabase.rpc("admin_integration_secret_status", { _provider: "evolution" }),
      ]);
      return {
        config: (configRow?.config as { base_url?: string; instance?: string }) ?? {},
        enabled: configRow?.enabled ?? false,
        api_key_set: (secretRows ?? []).some((r) => r.secret_name === "api_key"),
      };
    },
  });

  useEffect(() => {
    if (existing.data && open) {
      setBaseUrl(existing.data.config.base_url ?? "");
      setApiKey("");
      setQr(null);
      setState(null);
    }
  }, [existing.data, open]);

  useEffect(() => {
    if (!qr || state === "open") return;
    const id = setInterval(async () => {
      const { data } = await supabase.functions.invoke("evolution-instance-status", {
        body: { base_url: baseUrl, api_key: apiKey, instance: qr.instance },
      });
      if (data?.ok) setState(data.state);
    }, 3000);
    return () => clearInterval(id);
  }, [qr, baseUrl, apiKey, state]);

  useEffect(() => {
    if (state !== "open" || !qr) return;
    (async () => {
      await supabase.from("integration_configs").upsert(
        {
          provider: "evolution",
          enabled: true,
          config: { base_url: baseUrl, instance: qr.instance },
        },
        { onConflict: "provider" },
      );
      if (apiKey) {
        await supabase.rpc("admin_set_integration_secret", {
          _provider: "evolution",
          _secret_name: "api_key",
          _value: apiKey,
        });
      }
      qc.invalidateQueries({ queryKey: ["integration-overview"] });
      toast.success("WhatsApp conectado");
      setTimeout(() => onOpenChange(false), 1500);
    })();
  }, [state, qr, baseUrl, apiKey, qc, onOpenChange]);

  const connect = async () => {
    if (!baseUrl || (!apiKey && !existing.data?.api_key_set)) {
      toast.error("Preencha Base URL e API Key");
      return;
    }
    setConnecting(true);
    setState(null);
    try {
      const { data, error } = await supabase.functions.invoke("evolution-create-instance", {
        body: { base_url: baseUrl, api_key: apiKey },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Falha");
      if (data.already_connected) {
        setQr({ instance: data.instance, qr_base64: null, pairing_code: null });
        setState("open");
        return;
      }
      setQr({
        instance: data.instance,
        qr_base64: data.qr_base64,
        pairing_code: data.pairing_code,
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Evolution API (WhatsApp)</DialogTitle>
          <DialogDescription>
            Conecte sua instância Evolution. A gente cria a instância e mostra o QR pra parear.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="flex items-center gap-2">
              Base URL <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="https://evolution.seu-dominio.com"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              disabled={!!qr}
            />
          </div>
          <div>
            <Label className="flex items-center gap-2">
              API Key <span className="text-destructive">*</span>
              {existing.data?.api_key_set && (
                <Badge className="bg-emerald-600 text-white text-[10px]">salvo</Badge>
              )}
            </Label>
            <Input
              type="password"
              autoComplete="off"
              placeholder={
                existing.data?.api_key_set
                  ? "••••••• (cole para substituir)"
                  : "API key da Evolution"
              }
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={!!qr}
            />
          </div>

          {qr && (
            <div className="rounded-md border bg-muted/30 p-4">
              <p className="text-sm font-medium">
                {state === "open" ? "✅ Conectado" : "Escaneie o QR code"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {state === "open"
                  ? `Instância "${qr.instance}" pareada.`
                  : `Status: ${state ?? "aguardando..."}`}
              </p>
              {state !== "open" && qr.qr_base64 && (
                <div className="mt-3 flex flex-col items-center gap-3">
                  <img
                    src={
                      qr.qr_base64.startsWith("data:")
                        ? qr.qr_base64
                        : `data:image/png;base64,${qr.qr_base64}`
                    }
                    alt="QR code Evolution"
                    className="h-56 w-56 rounded-md border bg-white p-2"
                  />
                  {qr.pairing_code && (
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Ou código:</p>
                      <p className="font-mono text-lg font-semibold tracking-widest">
                        {qr.pairing_code}
                      </p>
                    </div>
                  )}
                </div>
              )}
              {state === "open" && (
                <div className="mt-3 flex items-center justify-center gap-2 py-4">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <Button asChild variant="ghost" size="sm">
            <a href="https://doc.evolution-api.com" target="_blank" rel="noreferrer">
              Doc <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            {qr && state !== "open" && (
              <Button
                variant="outline"
                onClick={() => {
                  setQr(null);
                  setState(null);
                }}
              >
                Recomeçar
              </Button>
            )}
            {!qr && (
              <Button onClick={connect} disabled={connecting}>
                {connecting ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Conectando...
                  </>
                ) : (
                  "Conectar"
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
