import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Brain,
  CheckCircle2,
  Cog,
  FileText,
  Globe,
  Loader2,
  Mail,
  MessageCircle,
  Pencil,
  RefreshCw,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ProviderEditDialog, type FieldDef } from "@/components/integrations/ProviderEditDialog";
import { EvolutionEditDialog } from "@/components/integrations/EvolutionEditDialog";

export const Route = createFileRoute("/app/integrations")({
  component: IntegrationsPage,
});

type Provider = "anthropic" | "inlabs" | "firecrawl" | "resend" | "evolution";

const META: Record<
  Provider,
  {
    title: string;
    description: string;
    icon: typeof Brain;
    required: boolean;
    docsUrl: string;
    fields?: FieldDef[]; // sem fields = Evolution (dialog próprio)
  }
> = {
  anthropic: {
    title: "Anthropic",
    description: "LLM que classifica matches e filtra falsos positivos.",
    icon: Brain,
    required: true,
    docsUrl: "https://console.anthropic.com/settings/keys",
    fields: [
      { key: "api_key", label: "API Key", secret: true, placeholder: "sk-ant-…", required: true },
      {
        key: "model",
        label: "Modelo principal",
        secret: false,
        placeholder: "claude-haiku-4-5-20251001",
      },
      {
        key: "ab_model",
        label: "Modelo B (A/B test)",
        secret: false,
        placeholder: "claude-sonnet-4-6 (deixe vazio para desativar)",
      },
      {
        key: "ab_ratio",
        label: "Fração para modelo B (0–1)",
        secret: false,
        placeholder: "0.2  →  20 % dos matches vão para o modelo B",
      },
    ],
  },
  inlabs: {
    title: "INLabs (DOU)",
    description: "Feed XML oficial do Diário da União. Grátis.",
    icon: FileText,
    required: false,
    docsUrl: "https://inlabs.in.gov.br/",
    fields: [
      { key: "email", label: "E-mail INLabs", secret: false, required: true },
      { key: "password", label: "Senha INLabs", secret: true, required: true },
    ],
  },
  firecrawl: {
    title: "Firecrawl",
    description: "Scraping fallback para DOEs estaduais.",
    icon: Globe,
    required: false,
    docsUrl: "https://firecrawl.dev",
    fields: [
      { key: "api_key", label: "API Key", secret: true, placeholder: "fc-…", required: true },
    ],
  },
  resend: {
    title: "Resend (e-mail)",
    description: "Envio de alertas por e-mail.",
    icon: Mail,
    required: false,
    docsUrl: "https://resend.com/api-keys",
    fields: [
      { key: "api_key", label: "API Key", secret: true, placeholder: "re_…", required: true },
      {
        key: "from_email",
        label: "Remetente",
        secret: false,
        placeholder: "alertas@seu-dominio.com",
        required: true,
      },
    ],
  },
  evolution: {
    title: "Evolution (WhatsApp)",
    description: "Self-hosted WhatsApp API com pareamento via QR code.",
    icon: MessageCircle,
    required: false,
    docsUrl: "https://doc.evolution-api.com",
  },
};

function IntegrationsPage() {
  const { user, loading } = useAuth();
  const isAdmin = useIsAdmin();

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!user) return <Navigate to="/login" />;
  if (!isAdmin) {
    return (
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Sem permissão</CardTitle>
          <CardDescription>Só admins gerenciam integrações.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return <IntegrationsContent />;
}

function IntegrationsContent() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Provider | null>(null);
  const [autoTesting, setAutoTesting] = useState<Set<Provider>>(new Set());
  const autoTestedRef = useRef<Set<Provider>>(new Set());

  const integrations = useQuery({
    queryKey: ["integration-overview"],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("integration_configs")
        .select("provider, enabled, last_tested_at, last_test_ok, last_test_error");
      const results: Record<string, { secrets_count: number }> = {};
      await Promise.all(
        Object.keys(META).map(async (p) => {
          const { data } = await supabase.rpc("admin_integration_secret_status", { _provider: p });
          results[p] = { secrets_count: data?.length ?? 0 };
        }),
      );
      return { rows: rows ?? [], secrets: results };
    },
  });

  // Auto-test integrations that are configured but never tested
  useEffect(() => {
    if (!integrations.data) return;
    const pending: Provider[] = (Object.keys(META) as Provider[]).filter((p) => {
      const row = integrations.data.rows.find((r) => r.provider === p);
      const hasSecrets = (integrations.data.secrets[p]?.secrets_count ?? 0) > 0;
      return (
        !!row?.enabled && hasSecrets && row.last_test_ok === null && !autoTestedRef.current.has(p)
      );
    });
    if (pending.length === 0) return;
    pending.forEach((p) => autoTestedRef.current.add(p));
    setAutoTesting((s) => {
      const next = new Set(s);
      pending.forEach((p) => next.add(p));
      return next;
    });

    Promise.allSettled(
      pending.map((p) => supabase.functions.invoke("test-integration", { body: { provider: p } })),
    ).then(() => {
      setAutoTesting((s) => {
        const next = new Set(s);
        pending.forEach((p) => next.delete(p));
        return next;
      });
      qc.invalidateQueries({ queryKey: ["integration-overview"] });
    });
  }, [integrations.data, qc]);

  const disconnect = useMutation({
    mutationFn: async (provider: Provider) => {
      const { data: secrets } = await supabase.rpc("admin_integration_secret_status", {
        _provider: provider,
      });
      for (const s of secrets ?? []) {
        await supabase.rpc("admin_remove_integration_secret", {
          _provider: provider,
          _secret_name: s.secret_name,
        });
      }
      await supabase
        .from("integration_configs")
        .update({ enabled: false, config: {}, last_test_ok: null, last_test_error: null })
        .eq("provider", provider);
    },
    onSuccess: () => {
      toast.success("Integração desconectada");
      qc.invalidateQueries({ queryKey: ["integration-overview"] });
      qc.invalidateQueries({ queryKey: ["onboarding-anthropic"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Integrações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            API keys são salvas <strong>criptografadas no Vault</strong>. Use o wizard para
            adicionar ou trocar uma.
          </p>
        </div>
        <Button onClick={() => navigate({ to: "/app/onboarding" })}>
          <Sparkles className="mr-2 h-4 w-4" /> Abrir wizard de configuração
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(Object.keys(META) as Provider[]).map((p) => {
          const meta = META[p];
          const Icon = meta.icon;
          const row = integrations.data?.rows.find((r) => r.provider === p);
          const hasSecrets = (integrations.data?.secrets[p]?.secrets_count ?? 0) > 0;
          const enabled = !!row?.enabled && hasSecrets;
          return (
            <Card key={p}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-muted">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <CardTitle className="text-sm font-medium">{meta.title}</CardTitle>
                      {meta.required && (
                        <Badge variant="outline" className="mt-1 text-[9px]">
                          obrigatório
                        </Badge>
                      )}
                    </div>
                  </div>
                  <StatusBadge
                    enabled={enabled}
                    testOk={row?.last_test_ok ?? null}
                    testing={autoTesting.has(p)}
                  />
                </div>
                <CardDescription className="pt-2 text-xs">{meta.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {row?.last_tested_at && (
                  <p className="text-[10px] text-muted-foreground">
                    Último teste:{" "}
                    {format(new Date(row.last_tested_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                )}
                {row?.last_test_ok === false && row.last_test_error && (
                  <p className="text-[10px] text-destructive">{row.last_test_error}</p>
                )}
                <div className="flex gap-1.5 pt-1">
                  <Button size="sm" variant="outline" onClick={() => setEditing(p)}>
                    <Pencil className="mr-1 h-3 w-3" />
                    {enabled ? "Editar" : "Configurar"}
                  </Button>
                  {enabled && (
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Testar agora"
                      disabled={autoTesting.has(p)}
                      onClick={async () => {
                        autoTestedRef.current.delete(p);
                        setAutoTesting((s) => new Set(s).add(p));
                        await supabase.functions.invoke("test-integration", {
                          body: { provider: p },
                        });
                        setAutoTesting((s) => {
                          const n = new Set(s);
                          n.delete(p);
                          return n;
                        });
                        qc.invalidateQueries({ queryKey: ["integration-overview"] });
                      }}
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${autoTesting.has(p) ? "animate-spin" : ""}`}
                      />
                    </Button>
                  )}
                  {enabled && (
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Desconectar"
                      onClick={() => {
                        if (confirm(`Desconectar ${meta.title}?`)) disconnect.mutate(p);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <RuntimeCard />

      {/* Edit dialogs */}
      {editing && editing !== "evolution" && META[editing].fields && (
        <ProviderEditDialog
          open
          onOpenChange={(o) => !o && setEditing(null)}
          provider={editing as "anthropic" | "inlabs" | "firecrawl" | "resend"}
          title={META[editing].title}
          description={META[editing].description}
          fields={META[editing].fields!}
          docsUrl={META[editing].docsUrl}
        />
      )}
      {editing === "evolution" && (
        <EvolutionEditDialog open onOpenChange={(o) => !o && setEditing(null)} />
      )}
    </div>
  );
}

function StatusBadge({
  enabled,
  testOk,
  testing,
}: {
  enabled: boolean;
  testOk: boolean | null;
  testing?: boolean;
}) {
  if (!enabled)
    return (
      <Badge variant="secondary" className="text-[10px]">
        Desconectado
      </Badge>
    );
  if (testing)
    return (
      <Badge variant="outline" className="text-[10px]">
        <Loader2 className="mr-0.5 h-2.5 w-2.5 animate-spin" /> Testando
      </Badge>
    );
  if (testOk === true)
    return (
      <Badge className="bg-emerald-600 text-white text-[10px]">
        <CheckCircle2 className="mr-0.5 h-2.5 w-2.5" /> OK
      </Badge>
    );
  if (testOk === false)
    return (
      <Badge variant="destructive" className="text-[10px]">
        <XCircle className="mr-0.5 h-2.5 w-2.5" /> Erro
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-[10px]">
      Aguardando teste
    </Badge>
  );
}

function RuntimeCard() {
  const qc = useQueryClient();
  const [activating, setActivating] = useState(false);

  const status = useQuery({
    queryKey: ["runtime-status"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_runtime_status");
      if (error) throw error;
      return data?.[0] ?? { functions_url: null, key_set: false, cron_enabled: false };
    },
  });

  const active = !!status.data?.key_set && !!status.data?.cron_enabled;

  const toggle = async (enable: boolean) => {
    setActivating(true);
    try {
      if (enable) {
        const anonKey =
          import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
          import.meta.env.VITE_SUPABASE_ANON_KEY ||
          "";
        const { data, error } = await supabase.functions.invoke("bootstrap-runtime", {
          body: { anon_key: anonKey },
        });
        if (error) throw error;
        if (!data?.ok) throw new Error(data?.error ?? "Falha ao ativar");
        toast.success("Pipeline ativo");
      } else {
        const { error } = await supabase.rpc("admin_apply_runtime", {
          _functions_url: status.data?.functions_url ?? "",
          _anon_key: "",
          _cron_enabled: false,
        });
        if (error) throw error;
        toast.success("Pipeline pausado");
      }
      qc.invalidateQueries({ queryKey: ["runtime-status"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setActivating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-muted">
              <Cog className="h-5 w-5" />
            </span>
            <div>
              <CardTitle className="text-base">Pipeline automático</CardTitle>
              <CardDescription className="mt-1">
                Liga os jobs periódicos de scraping, IA e notificações.
              </CardDescription>
            </div>
          </div>
          {active ? (
            <Badge className="bg-emerald-600 text-white">
              <CheckCircle2 className="mr-1 h-3 w-3" /> Ativo
            </Badge>
          ) : (
            <Badge variant="outline">Pausado</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <Label>Pipeline ativo</Label>
            <p className="text-xs text-muted-foreground">
              Scrape a cada 30min, IA a cada 2min, notificações a cada 1min.
            </p>
          </div>
          <Switch checked={active} disabled={activating} onCheckedChange={(v) => toggle(v)} />
        </div>
      </CardContent>
    </Card>
  );
}
