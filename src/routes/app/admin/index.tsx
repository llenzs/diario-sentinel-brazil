import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Activity,
  AlertTriangle,
  PlayCircle,
  RefreshCw,
  Inbox,
  Newspaper,
  Users,
  Brain,
  Send,
  Clock,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdminWithLoading } from "@/hooks/use-is-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/app/admin/")({
  component: AdminOverview,
});

function AdminOverview() {
  const { user, loading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useIsAdminWithLoading();
  const qc = useQueryClient();

  const metrics = useQuery({
    queryKey: ["daily-metrics"],
    enabled: !!user && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc("get_daily_metrics")
        .order("day", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const abStats = useQuery({
    queryKey: ["ab-test-stats"],
    enabled: !!user && isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("ab_test_stats").select("*");
      return (data ?? []) as {
        model: string;
        total: number;
        avg_confidence: number;
        fp_pct: number;
        avg_confidence_tp: number;
      }[];
    },
    refetchInterval: 60_000,
  });

  const ops = useQuery({
    queryKey: ["admin-ops-snapshot"],
    enabled: !!user && isAdmin,
    queryFn: async () => {
      const [pendingAI, dlq, queued, failedRuns] = await Promise.all([
        supabase
          .from("matches")
          .select("id", { count: "exact", head: true })
          .is("ai_processed_at", null),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("status", "dlq"),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("status", "queued"),
        supabase
          .from("scrape_runs")
          .select("id", { count: "exact", head: true })
          .eq("status", "failed")
          .gte("created_at", new Date(Date.now() - 86400_000).toISOString()),
      ]);
      return {
        pendingAI: pendingAI.count ?? 0,
        dlq: dlq.count ?? 0,
        queued: queued.count ?? 0,
        failedRuns24h: failedRuns.count ?? 0,
      };
    },
    refetchInterval: 30_000,
  });

  const runOrchestrator = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("scrape-orchestrator", {
        body: { force: true },
      });
      if (error) throw new Error(error.message || "Falha");
      return data as { total: number; enqueued: number; skipped: number; failed: number };
    },
    onSuccess: (data) => {
      toast.success(
        `${data.enqueued}/${data.total} fontes re-enfileiradas (${data.skipped} puladas, ${data.failed} falhas)`,
      );
      qc.invalidateQueries({ queryKey: ["admin-ops-snapshot"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runClassifier = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_trigger_classifier");
      if (error) throw error;
    },
    onSuccess: () => toast.success("Classificador disparado"),
    onError: (e: Error) => toast.error(e.message),
  });

  const runDispatcher = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_trigger_dispatcher");
      if (error) throw error;
    },
    onSuccess: () => toast.success("Dispatcher disparado"),
    onError: (e: Error) => toast.error(e.message),
  });

  const runPipeline = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("scrape-orchestrator", {
        body: { force: true },
      });
      if (error) throw new Error(error.message || "Falha ao disparar pipeline");
      return data as { total: number; enqueued: number; skipped: number; failed: number };
    },
    onSuccess: (data) => {
      toast.success(
        `Pipeline disparado: ${data.enqueued} fontes re-enfileiradas. IA e notificações disparam em cascata via triggers.`,
      );
      qc.invalidateQueries({ queryKey: ["admin-ops-snapshot"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading || adminLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!user) return <Navigate to="/login" />;
  if (!isAdmin)
    return (
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Sem permissão</CardTitle>
        </CardHeader>
      </Card>
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Operações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Saúde do pipeline e ações administrativas.
          </p>
        </div>
        <Button onClick={() => runPipeline.mutate()} disabled={runPipeline.isPending} size="lg">
          <Zap className="mr-2 h-4 w-4" />
          {runPipeline.isPending ? "Disparando..." : "Rodar pipeline completo"}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Disparos manuais</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => runOrchestrator.mutate()}
            disabled={runOrchestrator.isPending}
          >
            <PlayCircle className="mr-1.5 h-3.5 w-3.5" /> Scrape (orchestrator)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => runClassifier.mutate()}
            disabled={runClassifier.isPending}
          >
            <Brain className="mr-1.5 h-3.5 w-3.5" /> Classificar matches
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => runDispatcher.mutate()}
            disabled={runDispatcher.isPending}
          >
            <Send className="mr-1.5 h-3.5 w-3.5" /> Enviar notificações
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/app/admin/cron">
              <Clock className="mr-1.5 h-3.5 w-3.5" /> Configurar cron
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <OpsCard
          icon={Activity}
          label="Matches aguardando IA"
          value={ops.data?.pendingAI ?? 0}
          tone={ops.data && ops.data.pendingAI > 100 ? "warning" : "normal"}
        />
        <OpsCard
          icon={Inbox}
          label="Notificações na fila"
          value={ops.data?.queued ?? 0}
          tone="normal"
        />
        <OpsCard
          icon={AlertTriangle}
          label="DLQ (notificações)"
          value={ops.data?.dlq ?? 0}
          tone={ops.data && ops.data.dlq > 0 ? "danger" : "normal"}
          href="/app/admin/dlq"
        />
        <OpsCard
          icon={RefreshCw}
          label="Scrapes falhos (24h)"
          value={ops.data?.failedRuns24h ?? 0}
          tone={ops.data && ops.data.failedRuns24h > 0 ? "warning" : "normal"}
          href="/app/admin/runs"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Publicações ingeridas (30d)</CardTitle>
        </CardHeader>
        <CardContent className="h-64 p-0 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={metrics.data ?? []}>
              <XAxis dataKey="day" tickFormatter={(d: string) => d.slice(5)} fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Bar dataKey="publications_count" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Matches por dia (30d)</CardTitle>
          </CardHeader>
          <CardContent className="h-56 p-0 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.data ?? []}>
                <XAxis dataKey="day" tickFormatter={(d: string) => d.slice(5)} fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="matches_real" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notificações enviadas (30d)</CardTitle>
          </CardHeader>
          <CardContent className="h-56 p-0 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.data ?? []}>
                <XAxis dataKey="day" tickFormatter={(d: string) => d.slice(5)} fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="notifications_sent" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {(abStats.data ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">A/B test — comparação de modelos</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2">Modelo</th>
                  <th className="px-4 py-2 text-right">Matches</th>
                  <th className="px-4 py-2 text-right">Conf. média</th>
                  <th className="px-4 py-2 text-right">Conf. (só TP)</th>
                  <th className="px-4 py-2 text-right">Falsos positivos</th>
                </tr>
              </thead>
              <tbody>
                {abStats.data!.map((row) => (
                  <tr key={row.model} className="border-b last:border-0">
                    <td className="px-4 py-2 font-mono text-xs">{row.model}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{row.total}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{row.avg_confidence}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {row.avg_confidence_tp ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      <Badge
                        variant={Number(row.fp_pct) > 20 ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        {row.fp_pct}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ações</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/app/admin/runs">
              <RefreshCw className="mr-2 h-3.5 w-3.5" /> Scrape runs
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/app/admin/dlq">
              <AlertTriangle className="mr-2 h-3.5 w-3.5" /> DLQ
              {ops.data && ops.data.dlq > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {ops.data.dlq}
                </Badge>
              )}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/app/admin/sources">
              <Newspaper className="mr-2 h-3.5 w-3.5" /> Fontes (config)
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/app/admin/team">
              <Users className="mr-2 h-3.5 w-3.5" /> Membros
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function OpsCard({
  icon: Icon,
  label,
  value,
  tone,
  href,
}: {
  icon: typeof Activity;
  label: string;
  value: number;
  tone: "normal" | "warning" | "danger";
  href?: "/app/admin/runs" | "/app/admin/dlq";
}) {
  const toneClass =
    tone === "danger"
      ? "border-destructive/40 bg-destructive/5"
      : tone === "warning"
        ? "border-amber-500/40 bg-amber-500/5"
        : "";
  const card = (
    <Card className={toneClass}>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardContent>
    </Card>
  );
  return href ? (
    <Link to={href} className="transition-opacity hover:opacity-80">
      {card}
    </Link>
  ) : (
    card
  );
}
