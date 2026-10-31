import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, Loader2, XCircle } from "lucide-react";
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

export type Provider = "anthropic" | "inlabs" | "firecrawl" | "resend";

export type FieldDef = {
  key: string;
  label: string;
  secret: boolean;
  placeholder?: string;
  description?: string;
  required?: boolean;
  type?: "text" | "password";
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: Provider;
  title: string;
  description: string;
  fields: FieldDef[];
  docsUrl: string;
};

export function ProviderEditDialog({
  open,
  onOpenChange,
  provider,
  title,
  description,
  fields,
  docsUrl,
}: Props) {
  const qc = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const existing = useQuery({
    queryKey: ["provider-edit", provider, open],
    enabled: open,
    queryFn: async () => {
      const [{ data: configRow }, { data: secretRows }] = await Promise.all([
        supabase
          .from("integration_configs")
          .select("config, enabled")
          .eq("provider", provider)
          .maybeSingle(),
        supabase.rpc("admin_integration_secret_status", { _provider: provider }),
      ]);
      return {
        config: (configRow?.config as Record<string, string>) ?? {},
        enabled: configRow?.enabled ?? false,
        secrets_set: new Set((secretRows ?? []).map((r) => r.secret_name)),
      };
    },
  });

  useEffect(() => {
    if (existing.data && open) {
      setValues(
        Object.fromEntries(
          fields.filter((f) => !f.secret).map((f) => [f.key, existing.data!.config[f.key] ?? ""]),
        ),
      );
      setTestResult(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing.data, open]);

  const saveAndTest = async () => {
    for (const f of fields) {
      const isAlreadySet = f.secret && existing.data?.secrets_set.has(f.key);
      if (f.required && !values[f.key] && !isAlreadySet) {
        toast.error(`Preencha "${f.label}"`);
        return;
      }
    }

    setSaving(true);
    setTestResult(null);
    try {
      const inlineConfig = Object.fromEntries(
        fields.filter((f) => !f.secret).map((f) => [f.key, values[f.key] ?? ""]),
      );
      const inlineSecrets: Record<string, string> = {};
      for (const f of fields.filter((fld) => fld.secret)) {
        if (values[f.key]) inlineSecrets[f.key] = values[f.key];
      }

      const useStored =
        Object.keys(inlineSecrets).length === 0 && (existing.data?.secrets_set.size ?? 0) > 0;

      const { data, error } = await supabase.functions.invoke("test-integration", {
        body: useStored
          ? { provider }
          : { provider, inline: { config: inlineConfig, secrets: inlineSecrets } },
      });
      if (error) throw error;
      if (!data?.ok) {
        setTestResult({ ok: false, error: data?.error ?? "Falha no teste" });
        return;
      }

      await supabase
        .from("integration_configs")
        .upsert({ provider, enabled: true, config: inlineConfig }, { onConflict: "provider" });
      for (const [name, value] of Object.entries(inlineSecrets)) {
        const { error: secretErr } = await supabase.rpc("admin_set_integration_secret", {
          _provider: provider,
          _secret_name: name,
          _value: value,
        });
        if (secretErr) throw secretErr;
      }

      setTestResult({ ok: true });
      toast.success("Conectado e salvo");
      qc.invalidateQueries({ queryKey: ["integration-overview"] });
      qc.invalidateQueries({ queryKey: ["onboarding-anthropic"] });
      qc.invalidateQueries({ queryKey: ["provider-edit", provider] });

      setTimeout(() => onOpenChange(false), 800);
    } catch (e) {
      setTestResult({ ok: false, error: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {fields.map((f) => {
            const alreadySaved = f.secret && existing.data?.secrets_set.has(f.key);
            return (
              <div key={f.key}>
                <Label className="flex items-center gap-2">
                  {f.label}
                  {f.required && <span className="text-destructive">*</span>}
                  {alreadySaved && (
                    <Badge className="bg-emerald-600 text-white text-[10px]">salvo</Badge>
                  )}
                </Label>
                <Input
                  type={f.secret ? "password" : (f.type ?? "text")}
                  placeholder={alreadySaved ? "••••••• (cole para substituir)" : f.placeholder}
                  autoComplete="off"
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                />
                {f.description && (
                  <p className="mt-1 text-xs text-muted-foreground">{f.description}</p>
                )}
              </div>
            );
          })}

          {testResult && (
            <div
              className={`rounded-md border p-3 text-sm ${
                testResult.ok
                  ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                  : "border-destructive/40 bg-destructive/5 text-destructive"
              }`}
            >
              {testResult.ok ? (
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Conectado e salvo no Vault
                </span>
              ) : (
                <span className="flex items-start gap-2">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> {testResult.error}
                </span>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <Button asChild variant="ghost" size="sm">
            <a href={docsUrl} target="_blank" rel="noreferrer">
              Obter chave <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={saveAndTest} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Testando...
                </>
              ) : (
                "Testar e salvar"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
