import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Brain,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cog,
  ExternalLink,
  FileText,
  Globe,
  Loader2,
  Mail,
  MessageCircle,
  PartyPopper,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/app/onboarding")({
  component: OnboardingPage,
});

type Provider = "anthropic" | "inlabs" | "firecrawl" | "resend" | "evolution";

type StepDef = {
  id: string;
  title: string;
  subtitle: string;
  icon: typeof Brain;
  optional?: boolean;
};

const STEPS: StepDef[] = [
  {
    id: "welcome",
    title: "Bem-vindo",
    subtitle: "Vamos configurar seu monitor de Diário Oficial",
    icon: Sparkles,
  },
  {
    id: "anthropic",
    title: "Anthropic (IA)",
    subtitle: "Obrigatório — classifica os matches",
    icon: Brain,
  },
  {
    id: "inlabs",
    title: "INLabs (DOU)",
    subtitle: "Grátis — fonte oficial do Diário da União",
    icon: FileText,
    optional: true,
  },
  {
    id: "firecrawl",
    title: "Firecrawl (DOEs)",
    subtitle: "Coleta diários estaduais e municipais sem API própria",
    icon: Globe,
    optional: true,
  },
  {
    id: "channels",
    title: "Canais de alerta",
    subtitle: "E-mail (Resend) e/ou WhatsApp (Evolution)",
    icon: MessageCircle,
    optional: true,
  },
  {
    id: "runtime",
    title: "Ativar pipeline",
    subtitle: "Um clique para ligar o automático",
    icon: Cog,
  },
  { id: "done", title: "Pronto!", subtitle: "Cadastre seu primeiro termo", icon: PartyPopper },
];

function StepIndicator({ steps, current }: { steps: StepDef[]; current: number }) {
  return (
    <ol className="flex w-full items-start">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const isLast = i === steps.length - 1;
        return (
          <li key={s.id} className={`flex items-center ${isLast ? "" : "flex-1"}`}>
            <div className="flex flex-col items-center">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors ${
                  done
                    ? "border-primary bg-primary text-primary-foreground"
                    : active
                      ? "border-primary bg-background text-primary"
                      : "border-muted-foreground/30 bg-background text-muted-foreground"
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span
                className={`mt-1 hidden max-w-[60px] text-center text-[10px] leading-tight sm:block ${
                  active ? "font-medium text-foreground" : "text-muted-foreground"
                }`}
              >
                {s.title}
              </span>
            </div>
            {!isLast && (
              <div
                className={`mx-1 h-px flex-1 self-start transition-colors ${
                  done ? "bg-primary" : "bg-muted-foreground/20"
                }`}
                style={{ marginTop: "13px" }}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function OnboardingPage() {
  const { user, loading } = useAuth();
  const isAdmin = useIsAdmin();
  const [step, setStep] = useState(0);

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!user) return <Navigate to="/login" />;
  if (!isAdmin) return <Navigate to="/app" />;

  const StepIcon = STEPS[step].icon;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Configuração inicial</h1>
        <StepIndicator steps={STEPS} current={step} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <StepIcon className="h-5 w-5" />
            </span>
            <div>
              <CardTitle>{STEPS[step].title}</CardTitle>
              <CardDescription className="mt-1">{STEPS[step].subtitle}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {step === 0 && <Welcome onNext={() => setStep(1)} />}
          {step === 1 && (
            <ProviderStep
              provider="anthropic"
              fields={[
                {
                  key: "api_key",
                  label: "API Key",
                  secret: true,
                  placeholder: "sk-ant-…",
                  required: true,
                },
                {
                  key: "model",
                  label: "Modelo",
                  secret: false,
                  placeholder: "claude-haiku-4-5-20251001",
                },
              ]}
              docsUrl="https://console.anthropic.com/settings/keys"
              onNext={() => setStep(2)}
              onPrev={() => setStep(0)}
            />
          )}
          {step === 2 && (
            <ProviderStep
              provider="inlabs"
              fields={[
                { key: "email", label: "E-mail INLabs", secret: false, required: true },
                { key: "password", label: "Senha INLabs", secret: true, required: true },
              ]}
              docsUrl="https://inlabs.in.gov.br/"
              onNext={() => setStep(3)}
              onPrev={() => setStep(1)}
              skippable
            />
          )}
          {step === 3 && (
            <ProviderStep
              provider="firecrawl"
              fields={[
                {
                  key: "api_key",
                  label: "API Key",
                  secret: true,
                  placeholder: "fc-…",
                  required: true,
                },
              ]}
              docsUrl="https://firecrawl.dev"
              onNext={() => setStep(4)}
              onPrev={() => setStep(2)}
              skippable
            />
          )}
          {step === 4 && <ChannelsStep onNext={() => setStep(5)} onPrev={() => setStep(3)} />}
          {step === 5 && <RuntimeStep onNext={() => setStep(6)} onPrev={() => setStep(4)} />}
          {step === 6 && <Done />}
        </CardContent>
      </Card>
    </div>
  );
}

function Welcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm">
        Em ~3 minutos sua instância vai estar monitorando o Diário Oficial. Vamos coletar:
      </p>
      <ul className="space-y-2 text-sm">
        <Item icon={Brain}>
          <strong>Anthropic (Claude)</strong> — classifica matches e filtra falsos positivos.
          Obrigatório.
        </Item>
        <Item icon={FileText}>
          <strong>INLabs</strong> — feed XML oficial do DOU. Cadastro grátis.
        </Item>
        <Item icon={Globe}>
          <strong>Firecrawl</strong> — coleta diários estaduais e municipais que não têm API.
          Opcional (free tier de 500 scrapes/mês).
        </Item>
        <Item icon={Mail}>
          <strong>Resend</strong> ou <strong>Evolution (WhatsApp)</strong> — para receber os
          alertas. Pelo menos um.
        </Item>
        <Item icon={Cog}>
          <strong>Pipeline automático</strong> — um clique para ligar o cron de scraping, IA e
          notificação.
        </Item>
      </ul>
      <p className="text-xs text-muted-foreground">
        🔐 Todas as API keys são salvas <strong>criptografadas</strong> no Supabase Vault. Você pode
        revogar a qualquer momento.
      </p>
      <div className="flex justify-end pt-2">
        <Button onClick={onNext}>
          Começar <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function Item({ icon: Icon, children }: { icon: typeof Brain; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <span>{children}</span>
    </li>
  );
}

type FieldDef = {
  key: string;
  label: string;
  secret: boolean; // true → Vault; false → config jsonb
  placeholder?: string;
  required?: boolean;
};

function ProviderStep({
  provider,
  fields,
  docsUrl,
  onNext,
  onPrev,
  skippable,
}: {
  provider: Provider;
  fields: FieldDef[];
  docsUrl: string;
  onNext: () => void;
  onPrev: () => void;
  skippable?: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const qc = useQueryClient();

  // Load existing config so user sees what's already set
  const existing = useQuery({
    queryKey: ["onboarding-existing", provider],
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
    if (existing.data) {
      setValues((prev) => ({
        ...prev,
        ...Object.fromEntries(
          fields
            .filter((f) => !f.secret)
            .map((f) => [f.key, existing.data!.config[f.key] ?? prev[f.key] ?? ""]),
        ),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing.data]);

  const testAndSave = async () => {
    // Validate required
    for (const f of fields) {
      const isAlreadySet = f.secret && existing.data?.secrets_set.has(f.key);
      if (f.required && !values[f.key] && !isAlreadySet) {
        toast.error(`Preencha "${f.label}"`);
        return;
      }
    }

    setTesting(true);
    setTestResult(null);
    try {
      // Step 1: test inline (without saving first)
      const inlineConfig = Object.fromEntries(
        fields.filter((f) => !f.secret).map((f) => [f.key, values[f.key] ?? ""]),
      );
      // For secrets: use newly typed value, or fetch from Vault if already saved
      const inlineSecrets: Record<string, string> = {};
      for (const f of fields.filter((fld) => fld.secret)) {
        if (values[f.key]) inlineSecrets[f.key] = values[f.key];
        else if (existing.data?.secrets_set.has(f.key)) {
          // already saved; test against stored
        }
      }

      const useStored = Object.keys(inlineSecrets).length === 0 && existing.data?.secrets_set.size;
      const { data, error } = await supabase.functions.invoke("test-integration", {
        body: useStored
          ? { provider }
          : { provider, inline: { config: inlineConfig, secrets: inlineSecrets } },
      });
      if (error) throw error;
      if (!data?.ok) {
        setTestResult({ ok: false, error: data?.error ?? "Teste falhou" });
        setTesting(false);
        return;
      }

      // Step 2: persist (config jsonb + Vault secrets)
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
      qc.invalidateQueries({ queryKey: ["onboarding-existing", provider] });
      qc.invalidateQueries({ queryKey: ["integration-configs"] });
      qc.invalidateQueries({ queryKey: ["onboarding-anthropic"] });
    } catch (e) {
      setTestResult({ ok: false, error: (e as Error).message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
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
              type={f.secret ? "password" : "text"}
              placeholder={alreadySaved ? "••••••• (cole para substituir)" : f.placeholder}
              autoComplete="off"
              value={values[f.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            />
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
            <span>❌ {testResult.error}</span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={onPrev}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
        </Button>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <a href={docsUrl} target="_blank" rel="noreferrer">
              Obter chave <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </Button>
          {skippable && (
            <Button variant="outline" onClick={onNext}>
              Pular
            </Button>
          )}
          {testResult?.ok ? (
            <Button onClick={onNext}>
              Próximo <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={testAndSave} disabled={testing}>
              {testing ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Testando...
                </>
              ) : (
                "Testar e salvar"
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ChannelsStep({ onNext, onPrev }: { onNext: () => void; onPrev: () => void }) {
  const [tab, setTab] = useState<"resend" | "evolution">("resend");
  return (
    <div className="space-y-4">
      <div className="flex gap-2 rounded-md bg-muted p-1">
        <button
          className={`flex-1 rounded-sm px-3 py-1.5 text-sm transition-colors ${
            tab === "resend" ? "bg-background shadow-sm" : "text-muted-foreground"
          }`}
          onClick={() => setTab("resend")}
        >
          <Mail className="mr-1 inline h-3.5 w-3.5" /> E-mail (Resend)
        </button>
        <button
          className={`flex-1 rounded-sm px-3 py-1.5 text-sm transition-colors ${
            tab === "evolution" ? "bg-background shadow-sm" : "text-muted-foreground"
          }`}
          onClick={() => setTab("evolution")}
        >
          <MessageCircle className="mr-1 inline h-3.5 w-3.5" /> WhatsApp (Evolution)
        </button>
      </div>
      {tab === "resend" ? (
        <ProviderStep
          provider="resend"
          fields={[
            { key: "api_key", label: "API Key", secret: true, placeholder: "re_…", required: true },
            {
              key: "from_email",
              label: "Remetente",
              secret: false,
              placeholder: "alertas@seu-dominio.com",
              required: true,
            },
          ]}
          docsUrl="https://resend.com/api-keys"
          onNext={onNext}
          onPrev={onPrev}
          skippable
        />
      ) : (
        <EvolutionStep onNext={onNext} onPrev={onPrev} />
      )}
    </div>
  );
}

function EvolutionStep({ onNext, onPrev }: { onNext: () => void; onPrev: () => void }) {
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
    queryKey: ["onboarding-existing", "evolution"],
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
    if (existing.data) {
      if (existing.data.config.base_url) setBaseUrl(existing.data.config.base_url);
    }
  }, [existing.data]);

  // Polling: quando QR está visível, checa state a cada 3s
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

  // Quando conectado, persiste tudo automaticamente
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
      await supabase.rpc("admin_set_integration_secret", {
        _provider: "evolution",
        _secret_name: "api_key",
        _value: apiKey,
      });
      qc.invalidateQueries({ queryKey: ["integration-overview"] });
      toast.success("WhatsApp conectado");
    })();
  }, [state, qr, baseUrl, apiKey, qc]);

  const connect = async () => {
    if (!baseUrl || !apiKey) {
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
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Informe Base URL + API Key da sua Evolution API. Cuidamos da criação da instância e
        mostramos o QR code pra parear.
      </p>

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
            existing.data?.api_key_set ? "••••••• (cole para substituir)" : "API key da Evolution"
          }
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          disabled={!!qr}
        />
      </div>

      {qr && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {state === "open" ? "✅ Conectado" : "Escaneie o QR code"}
            </CardTitle>
            <CardDescription>
              {state === "open"
                ? `Instância "${qr.instance}" pareada com sucesso.`
                : `Abra o WhatsApp → ⋮ → Dispositivos conectados → Conectar dispositivo. Status: ${state ?? "aguardando..."}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {state !== "open" && qr.qr_base64 && (
              <div className="flex flex-col items-center gap-3">
                <img
                  src={
                    qr.qr_base64.startsWith("data:")
                      ? qr.qr_base64
                      : `data:image/png;base64,${qr.qr_base64}`
                  }
                  alt="QR code Evolution"
                  className="h-64 w-64 rounded-md border bg-white p-2"
                />
                {qr.pairing_code && (
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Ou use o código de pareamento:</p>
                    <p className="mt-1 font-mono text-lg font-semibold tracking-widest">
                      {qr.pairing_code}
                    </p>
                  </div>
                )}
              </div>
            )}
            {state === "open" && (
              <div className="flex items-center justify-center gap-2 py-6">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                <span className="text-sm">Tudo certo. Pode avançar.</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={onPrev}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
        </Button>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <a href="https://doc.evolution-api.com" target="_blank" rel="noreferrer">
              Doc Evolution <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </Button>
          <Button variant="outline" onClick={onNext}>
            Pular
          </Button>
          {state === "open" ? (
            <Button onClick={onNext}>
              Próximo <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : qr ? (
            <Button
              variant="outline"
              onClick={() => {
                setQr(null);
                setState(null);
              }}
            >
              Recomeçar
            </Button>
          ) : (
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
      </div>
    </div>
  );
}

function RuntimeStep({ onNext, onPrev }: { onNext: () => void; onPrev: () => void }) {
  const [activating, setActivating] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; smoke?: string; error?: string } | null>(
    null,
  );
  const qc = useQueryClient();

  const status = useQuery({
    queryKey: ["runtime-status"],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_runtime_status");
      return data?.[0] ?? { functions_url: null, key_set: false, cron_enabled: false };
    },
  });

  const alreadyActive = !!status.data?.key_set && !!status.data?.cron_enabled;

  const activate = async () => {
    setActivating(true);
    setResult(null);
    try {
      const anonKey =
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        import.meta.env.VITE_SUPABASE_ANON_KEY ||
        "";
      const { data, error } = await supabase.functions.invoke("bootstrap-runtime", {
        body: { anon_key: anonKey },
      });
      if (error) throw error;
      if (!data?.ok) {
        setResult({ ok: false, error: data?.error ?? "Falha ao ativar" });
        return;
      }
      setResult({ ok: true, smoke: data.smoke_test });
      qc.invalidateQueries({ queryKey: ["runtime-status"] });
      toast.success("Pipeline ativado");
    } catch (e) {
      setResult({ ok: false, error: (e as Error).message });
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        O pipeline conecta seu banco às edge functions de scraping/IA/notificação. É só clicar —
        fazemos toda a parte técnica por você.
      </p>

      {alreadyActive && !result && (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">
          <span className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> Pipeline já está ativo
          </span>
        </div>
      )}

      {result && (
        <div
          className={`rounded-md border p-3 text-sm ${
            result.ok
              ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
              : "border-destructive/40 bg-destructive/5 text-destructive"
          }`}
        >
          {result.ok ? (
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Pipeline ativo
              {result.smoke === "passed" && " — teste de fumaça passou ✓"}
            </span>
          ) : (
            <span>❌ {result.error}</span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={onPrev}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
        </Button>
        {alreadyActive || result?.ok ? (
          <Button onClick={onNext}>
            Próximo <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={activate} disabled={activating}>
            {activating ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Ativando...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" /> Ativar pipeline
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

function Done() {
  const navigate = useNavigate();
  return (
    <div className="space-y-5 text-center">
      <PartyPopper className="mx-auto h-12 w-12 text-primary" />
      <h2 className="text-xl font-semibold">Tudo pronto!</h2>
      <p className="text-sm text-muted-foreground">
        Seu monitor está rodando. Cadastre seu primeiro termo e em até 30min você verá o primeiro
        match na tela de alertas.
      </p>
      <div className="flex flex-wrap justify-center gap-2 pt-2">
        <Button onClick={() => navigate({ to: "/app/terms" })}>Cadastrar primeiro termo</Button>
        <Button variant="outline" onClick={() => navigate({ to: "/app" })}>
          Ir para o dashboard
        </Button>
      </div>
    </div>
  );
}
