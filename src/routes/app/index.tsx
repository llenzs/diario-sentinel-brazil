import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Brain,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Mail,
  MessageCircle,
  Newspaper,
  PlayCircle,
  Plus,
  Sparkles,
  Tag,
  Zap,
} from "lucide-react";
import { format, formatDistanceToNow, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
});

const CATEGORY_COLORS: Record<string, string> = {
  licitacao: "hsl(220 70% 55%)",
  nomeacao: "hsl(155 60% 45%)",
  exoneracao: "hsl(15 75% 55%)",
  processo: "hsl(280 60% 55%)",
  multa: "hsl(0 70% 55%)",
  homologacao: "hsl(45 80% 50%)",
  outro: "hsl(220 10% 55%)",
};

function Dashboard() {
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();

  const stats = useQuery({
    queryKey: ["dashboard-v2"],
    enabled: !!user?.id,
    queryFn: async () => {
      const now = Date.now();
      const since7d = new Date(now - 7 * 86400_000).toISOString();
      const since14d = new Date(now - 14 * 86400_000).toISOString();

      const [
        terms,
        matchesAll,
        matchesWeek,
        matchesPrevWeek,
        notifSent,
        notifTotal,
        integrations,
        runtime,
        lastScrape,
        byCategory,
        lastMatches,
        topTerms,
      ] = await Promise.all([
        supabase.from("terms").select("id", { count: "exact", head: true }).eq("active", true),
        supabase
          .from("matches")
          .select("id", { count: "exact", head: true })
          .eq("is_false_positive", false),
        supabase
          .from("matches")
          .select("id", { count: "exact", head: true })
          .eq("is_false_positive", false)
          .gte("created_at", since7d),
        supabase
          .from("matches")
          .select("id", { count: "exact", head: true })
          .eq("is_false_positive", false)
          .gte("created_at", since14d)
          .lt("created_at", since7d),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("status", "sent"),
        supabase.from("notifications").select("id", { count: "exact", head: true }),
        supabase.from("integration_status").select("provider, enabled, last_test_ok"),
        supabase.rpc("get_runtime_status").maybeSingle(),
        supabase
          .from("scrape_runs")
          .select("publication_date, finished_at, status")
          .order("finished_at", { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("matches")
          .select("ai_category")
          .eq("is_false_positive", false)
          .not("ai_category", "is", null)
          .gte("created_at", since14d),
        supabase
          .from("matches")
          .select(
            "id, excerpt, ai_category, ai_summary, created_at, terms(label), publications(publication_date, url, sources(name))",
          )
          .eq("is_false_positive", false)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("matches")
          .select("term_id, terms(label)")
          .eq("is_false_positive", false)
          .gte("created_at", since7d),
      ]);

      // Daily series for chart (last 14 days)
      const dailyMetrics = await supabase
        .rpc("get_daily_metrics")
        .select("day, matches_real")
        .gte("day", new Date(now - 14 * 86400_000).toISOString().slice(0, 10))
        .order("day");
      if (dailyMetrics.error) throw dailyMetrics.error;

      const categoryAgg = new Map<string, number>();
      for (const m of byCategory.data ?? []) {
        const cat = (m as { ai_category: string | null }).ai_category;
        if (cat) categoryAgg.set(cat, (categoryAgg.get(cat) ?? 0) + 1);
      }

      const termsAgg = new Map<string, { label: string; count: number }>();
      for (const m of topTerms.data ?? []) {
        const row = m as { term_id: string; terms?: { label: string } | null };
        const existing = termsAgg.get(row.term_id);
        if (existing) existing.count++;
        else if (row.terms?.label) termsAgg.set(row.term_id, { label: row.terms.label, count: 1 });
      }
      const top = Array.from(termsAgg.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const integrationsList = (integrations.data ?? []).filter((i) => i.provider !== "_runtime");
      const requiredOk = integrationsList.find((i) => i.provider === "anthropic")?.enabled === true;

      return {
        activeTerms: terms.count ?? 0,
        totalMatches: matchesAll.count ?? 0,
        weekMatches: matchesWeek.count ?? 0,
        prevWeekMatches: matchesPrevWeek.count ?? 0,
        sentNotifications: notifSent.count ?? 0,
        totalNotifications: notifTotal.count ?? 0,
        integrations: integrationsList,
        runtime: runtime.data as {
          functions_url: string | null;
          key_set: boolean;
          cron_enabled: boolean;
        } | null,
        lastScrape: lastScrape.data,
        requiredOk,
        categorySeries: Array.from(categoryAgg.entries()).map(([name, value]) => ({
          name,
          value,
        })),
        dailySeries: (dailyMetrics.data ?? [])
          .filter((d): d is { day: string; matches_real: number } => !!d.day)
          .map((d) => ({
            day: d.day,
            short: d.day.slice(5),
            matches: d.matches_real ?? 0,
          })),
        lastMatches: lastMatches.data ?? [],
        topTerms: top,
      };
    },
    refetchInterval: 60_000,
  });

  const runPipeline = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("scrape-orchestrator", {
        body: { force: true },
      });
      if (error) throw new Error(error.message || "Falha ao invocar orchestrator");
      return (data ?? {}) as Partial<{
        date: string;
        total: number;
        enqueued: number;
        skipped: number;
        failed: number;
      }>;
    },
    onSuccess: (data) => {
      const enqueued = data?.enqueued ?? 0;
      const failed = data?.failed ?? 0;
      const total = data?.total ?? 0;
      if (enqueued > 0) {
        toast.success(
          `${enqueued}/${total} fontes re-enfileiradas. Aguarde alguns minutos pelos novos matches.`,
        );
      } else if (failed > 0) {
        toast.error(`${failed} fontes falharam ao enfileirar`);
      } else {
        toast.info(`${total} fontes processadas — nenhuma nova execução necessária`);
      }
      qc.invalidateQueries({ queryKey: ["dashboard-v2"] });
      qc.invalidateQueries({ queryKey: ["active-scrape-runs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activeRuns = useQuery({
    queryKey: ["active-scrape-runs"],
    enabled: !!user?.id,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [pending, running, recent] = await Promise.all([
        supabase
          .from("scrape_runs")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .eq("publication_date", today),
        supabase
          .from("scrape_runs")
          .select("id", { count: "exact", head: true })
          .eq("status", "running")
          .eq("publication_date", today),
        supabase
          .from("scrape_runs")
          .select("id", { count: "exact", head: true })
          .eq("status", "success")
          .eq("publication_date", today)
          .gte("finished_at", new Date(Date.now() - 5 * 60_000).toISOString()),
      ]);
      return {
        pending: pending.count ?? 0,
        running: running.count ?? 0,
        recentSuccess: recent.count ?? 0,
      };
    },
    refetchInterval: 3_000,
  });
  const pipelineActive = (activeRuns.data?.pending ?? 0) + (activeRuns.data?.running ?? 0);

  const greeting = useGreeting();
  const displayName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "";

  const weekChange = pctChange(stats.data?.weekMatches ?? 0, stats.data?.prevWeekMatches ?? 0);
  const deliveryRate =
    (stats.data?.totalNotifications ?? 0) > 0
      ? ((stats.data!.sentNotifications / stats.data!.totalNotifications) * 100).toFixed(1)
      : null;

  const pipelineHealthy = !!stats.data?.runtime?.cron_enabled && !!stats.data?.requiredOk;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{greeting},</p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{displayName} 👋</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Aqui está o que aconteceu nos diários oficiais que você monitora.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/app/terms">
              <Plus className="mr-2 h-4 w-4" /> Novo termo
            </Link>
          </Button>
          {isAdmin && (
            <Button
              onClick={() => runPipeline.mutate()}
              disabled={runPipeline.isPending || pipelineActive > 0}
            >
              {runPipeline.isPending || pipelineActive > 0 ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {pipelineActive > 0 ? `Rodando (${pipelineActive})...` : "Disparando..."}
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Rodar pipeline
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Pipeline live status */}
      {pipelineActive > 0 && (
        <Card className="border-blue-500/40 bg-blue-500/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-start gap-3">
              <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-sm font-medium">
                  Pipeline rodando: {pipelineActive} fonte{pipelineActive === 1 ? "" : "s"} em
                  processamento
                </p>
                <p className="text-xs text-muted-foreground">
                  {activeRuns.data?.running ?? 0} rodando · {activeRuns.data?.pending ?? 0} na fila
                  {(activeRuns.data?.recentSuccess ?? 0) > 0
                    ? ` · ${activeRuns.data?.recentSuccess} concluída(s) há pouco`
                    : ""}
                </p>
              </div>
            </div>
            {isAdmin && (
              <Button asChild size="sm" variant="outline">
                <Link to="/app/admin/runs">
                  Ver detalhes <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Alert banners */}
      {stats.isSuccess && !stats.data.requiredOk && isAdmin && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="text-sm font-medium">
                  Configure a Anthropic para começar a classificar matches
                </p>
                <p className="text-xs text-muted-foreground">Sem isso, alertas não saem.</p>
              </div>
            </div>
            <Button asChild size="sm">
              <Link to="/app/onboarding">
                Configurar agora <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
      {stats.isSuccess && stats.data.requiredOk && isAdmin && !stats.data.runtime?.cron_enabled && (
        <Card className="border-blue-500/40 bg-blue-500/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-start gap-3">
              <PlayCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-sm font-medium">Pipeline pausado</p>
                <p className="text-xs text-muted-foreground">
                  Ative o cron pra começar a receber alertas automaticamente.
                </p>
              </div>
            </div>
            <Button asChild size="sm">
              <Link to="/app/integrations">Ativar pipeline</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Termos ativos"
          value={stats.data?.activeTerms ?? 0}
          icon={Tag}
          href="/app/terms"
          loading={stats.isLoading}
        />
        <KpiCard
          label="Matches (7d)"
          value={stats.data?.weekMatches ?? 0}
          icon={Bell}
          href="/app/alerts"
          loading={stats.isLoading}
          delta={weekChange}
        />
        <KpiCard
          label="Total acumulado"
          value={stats.data?.totalMatches ?? 0}
          icon={Activity}
          href="/app/alerts"
          loading={stats.isLoading}
        />
        <KpiCard
          label="Entrega de alertas"
          value={deliveryRate ? `${deliveryRate}%` : "—"}
          icon={CheckCircle2}
          href="/app/notifications"
          loading={stats.isLoading}
          subtitle={
            stats.data
              ? `${stats.data.sentNotifications}/${stats.data.totalNotifications} entregues`
              : undefined
          }
        />
      </div>

      {/* AI Briefing */}
      <BriefingCard />

      {/* Charts grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Matches por dia</CardTitle>
            <CardDescription>Últimos 14 dias</CardDescription>
          </CardHeader>
          <CardContent className="h-64 p-2 pt-4">
            {stats.isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (stats.data?.dailySeries.length ?? 0) === 0 ? (
              <EmptyChart message="Sem dados ainda. Quando o pipeline rodar, os matches aparecem aqui." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.data!.dailySeries}>
                  <XAxis dataKey="short" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} width={28} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--background))",
                      fontSize: 12,
                    }}
                    labelFormatter={(l) => `${l}`}
                  />
                  <Bar dataKey="matches" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Por categoria</CardTitle>
            <CardDescription>Últimos 14 dias</CardDescription>
          </CardHeader>
          <CardContent className="h-64 p-2 pt-4">
            {stats.isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (stats.data?.categorySeries.length ?? 0) === 0 ? (
              <EmptyChart message="Aguardando classificações" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.data!.categorySeries}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={2}
                  >
                    {stats.data!.categorySeries.map((entry) => (
                      <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] ?? "#888"} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--background))",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            {(stats.data?.categorySeries.length ?? 0) > 0 && (
              <div className="mt-2 flex flex-wrap gap-2 px-2 text-[10px]">
                {stats.data!.categorySeries.map((c) => (
                  <span key={c.name} className="flex items-center gap-1 capitalize">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: CATEGORY_COLORS[c.name] ?? "#888" }}
                    />
                    {c.name}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Atividade + top terms */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base">Alertas recentes</CardTitle>
              <CardDescription>Últimas 5 publicações detectadas</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/app/alerts">
                Ver todos <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.isLoading ? (
              <>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </>
            ) : (stats.data?.lastMatches.length ?? 0) === 0 ? (
              <div className="grid place-items-center gap-2 py-8 text-center">
                <Newspaper className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">Sem alertas ainda</p>
                <p className="text-xs text-muted-foreground">
                  Cadastre termos e aguarde o próximo ciclo do pipeline.
                </p>
              </div>
            ) : (
              stats.data!.lastMatches.map((m) => (
                <MatchRow key={(m as { id: string }).id} match={m} />
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Top termos (7d)</CardTitle>
            <CardDescription>Mais ativos na semana</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (stats.data?.topTerms.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados na semana.</p>
            ) : (
              <ul className="space-y-2">
                {stats.data!.topTerms.map((t, i) => (
                  <li key={t.label} className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-muted text-xs font-mono">
                        {i + 1}
                      </span>
                      <span className="truncate text-sm">{t.label}</span>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {t.count}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Health row */}
      {isAdmin && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Pipeline</CardTitle>
                {pipelineHealthy ? (
                  <Badge className="bg-emerald-600 text-white text-[10px]">
                    <CheckCircle2 className="mr-1 h-2.5 w-2.5" /> saudável
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">
                    aguardando
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <Row label="Cron ativo">
                <Bool value={!!stats.data?.runtime?.cron_enabled} />
              </Row>
              <Row label="Anthropic conectado">
                <Bool value={!!stats.data?.requiredOk} />
              </Row>
              <Row label="Último scrape">
                {stats.data?.lastScrape?.finished_at
                  ? formatDistanceToNow(new Date(stats.data.lastScrape.finished_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })
                  : "—"}
              </Row>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Integrações</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid grid-cols-2 gap-2">
                {(stats.data?.integrations ?? []).map((i) => (
                  <IntegrationPill
                    key={i.provider!}
                    provider={i.provider!}
                    enabled={!!i.enabled}
                    testOk={i.last_test_ok}
                  />
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function BriefingCard() {
  const briefing = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("ai-briefing", { body: {} });
      if (error) throw error;
      return data as { briefing: string; match_count: number };
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <CardTitle className="text-base">Briefing semanal por IA</CardTitle>
              <CardDescription className="text-xs">
                Resumo executivo dos seus alertas dos últimos 7 dias.
              </CardDescription>
            </div>
          </div>
          <Button
            size="sm"
            variant={briefing.data ? "outline" : "default"}
            onClick={() => briefing.mutate()}
            disabled={briefing.isPending}
          >
            {briefing.isPending ? (
              <>
                <Sparkles className="mr-2 h-3.5 w-3.5 animate-pulse" /> Gerando...
              </>
            ) : briefing.data ? (
              "Regenerar"
            ) : (
              <>
                <Sparkles className="mr-2 h-3.5 w-3.5" /> Gerar briefing
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      {briefing.data && (
        <CardContent>
          <div className="space-y-2 text-sm leading-relaxed">
            {briefing.data.briefing.split(/\n\n+/).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          {briefing.data.match_count > 0 && (
            <p className="mt-4 text-[10px] uppercase tracking-wider text-muted-foreground">
              Baseado em {briefing.data.match_count} alerta
              {briefing.data.match_count === 1 ? "" : "s"} dos últimos 7 dias.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  href,
  loading,
  delta,
  subtitle,
}: {
  label: string;
  value: number | string;
  icon: typeof Tag;
  href: "/app/terms" | "/app/alerts" | "/app/notifications";
  loading: boolean;
  delta?: { value: number; sign: "up" | "down" | "neutral" } | null;
  subtitle?: string;
}) {
  return (
    <Link to={href} className="block">
      <Card className="transition-all hover:border-primary/40 hover:shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          {loading ? (
            <Skeleton className="mt-3 h-8 w-16" />
          ) : (
            <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
          )}
          {delta && (
            <p
              className={`mt-1 inline-flex items-center gap-1 text-xs ${
                delta.sign === "up"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : delta.sign === "down"
                    ? "text-destructive"
                    : "text-muted-foreground"
              }`}
            >
              {delta.sign === "up" && <ArrowUpRight className="h-3 w-3" />}
              {delta.sign === "down" && <ArrowUpRight className="h-3 w-3 rotate-90" />}
              {delta.value > 0 ? `+${delta.value}%` : `${delta.value}%`}
              <span className="text-muted-foreground">vs. semana anterior</span>
            </p>
          )}
          {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
        </CardContent>
      </Card>
    </Link>
  );
}

function MatchRow({ match }: { match: unknown }) {
  const m = match as {
    id: string;
    excerpt: string;
    ai_category: string | null;
    ai_summary: string | null;
    created_at: string;
    terms: { label: string } | null;
    publications: {
      publication_date: string;
      url: string | null;
      sources: { name: string } | null;
    } | null;
  };
  return (
    <Link
      to="/app/alerts"
      className="block rounded-md border bg-card p-3 transition-colors hover:bg-accent/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{m.terms?.label ?? "—"}</span>
            {m.ai_category && (
              <Badge variant="outline" className="capitalize text-[10px]">
                {m.ai_category}
              </Badge>
            )}
            <span className="text-[10px] text-muted-foreground">
              {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: ptBR })}
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {m.publications?.sources?.name ?? "Fonte"} ·{" "}
            {m.ai_summary ?? m.excerpt.slice(0, 80) + "…"}
          </p>
        </div>
        {m.publications?.url && (
          <Button asChild size="sm" variant="ghost" className="shrink-0">
            <a
              href={m.publications.url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        )}
      </div>
    </Link>
  );
}

function IntegrationPill({
  provider,
  enabled,
  testOk,
}: {
  provider: string;
  enabled: boolean;
  testOk: boolean | null;
}) {
  const Icon =
    provider === "anthropic"
      ? Brain
      : provider === "evolution"
        ? MessageCircle
        : provider === "resend"
          ? Mail
          : Activity;
  const status = !enabled ? "off" : testOk === true ? "ok" : testOk === false ? "err" : "wait";
  return (
    <li className="flex items-center justify-between rounded-md border p-2">
      <span className="flex items-center gap-2 text-xs capitalize">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        {provider}
      </span>
      {status === "ok" && <span className="h-2 w-2 rounded-full bg-emerald-500" title="OK" />}
      {status === "err" && <span className="h-2 w-2 rounded-full bg-destructive" title="Erro" />}
      {status === "wait" && (
        <span className="h-2 w-2 rounded-full bg-amber-500" title="Aguardando teste" />
      )}
      {status === "off" && <span className="h-2 w-2 rounded-full bg-muted" title="Desconectado" />}
    </li>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{children}</span>
    </div>
  );
}

function Bool({ value }: { value: boolean }) {
  return value ? (
    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
  ) : (
    <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="grid h-full place-items-center px-4 text-center">
      <div>
        <Newspaper className="mx-auto h-8 w-8 text-muted-foreground/40" />
        <p className="mt-2 text-xs text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

function useGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function pctChange(
  current: number,
  prev: number,
): { value: number; sign: "up" | "down" | "neutral" } | null {
  if (prev === 0 && current === 0) return null;
  if (prev === 0) return { value: 100, sign: "up" };
  const pct = Math.round(((current - prev) / prev) * 100);
  return {
    value: pct,
    sign: pct > 0 ? "up" : pct < 0 ? "down" : "neutral",
  };
}
