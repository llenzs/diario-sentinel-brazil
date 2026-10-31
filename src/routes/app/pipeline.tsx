import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  CheckCircle2,
  Clock,
  Loader2,
  PlayCircle,
  XCircle,
  Hourglass,
  FileText,
  Tag,
  ExternalLink,
  Search,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdminStatus } from "@/hooks/use-is-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/app/pipeline")({
  component: PipelinePage,
});

type RunRow = {
  id: string;
  status: "pending" | "running" | "success" | "failed";
  pages_processed: number;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  sources: { id: string; code: string; name: string; scraper_adapter: string } | null;
};

type MatchResult = {
  id: string;
  excerpt: string;
  ai_summary: string | null;
  ai_category: string | null;
  created_at: string;
  terms: { label: string } | null;
  publications: {
    title: string | null;
    url: string | null;
    sources: { name: string } | null;
  } | null;
};

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function today() {
  return isoDate(new Date());
}

/** Sexta-feira se hoje for sáb/dom, senão hoje. */
function lastWeekday() {
  const d = new Date();
  const dow = d.getUTCDay(); // 0=Dom, 6=Sáb
  if (dow === 6) d.setUTCDate(d.getUTCDate() - 1);
  if (dow === 0) d.setUTCDate(d.getUTCDate() - 2);
  return isoDate(d);
}

/** Recua para sexta se cair em fim de semana. */
function toWeekday(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  const dow = d.getUTCDay();
  if (dow === 6) d.setUTCDate(d.getUTCDate() - 1);
  if (dow === 0) d.setUTCDate(d.getUTCDate() - 2);
  return isoDate(d);
}

function hasActive(runs: RunRow[]) {
  return runs.some((r) => r.status === "pending" || r.status === "running");
}

function PipelinePage() {
  const { user, loading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useIsAdminStatus();

  if (loading || adminLoading) return <p className="text-sm text-muted-foreground p-6">Carregando...</p>;
  if (!user) return <Navigate to="/login" />;
  if (!isAdmin) return <Navigate to="/app" />;

  return <PipelineContent />;
}

function PipelineContent() {
  const { user } = useAuth();
  const [date, setDate] = useState(lastWeekday());
  const [running, setRunning] = useState(false);

  // Poll scrape_runs for this date
  const runs = useQuery({
    queryKey: ["pipeline-runs", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scrape_runs")
        .select("id, status, pages_processed, started_at, finished_at, error, sources(id, code, name, scraper_adapter)")
        .eq("publication_date", date)
        .order("sources(name)");
      if (error) throw error;
      return (data ?? []) as unknown as RunRow[];
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data || data.length === 0) return running ? 2000 : false;
      return hasActive(data) ? 2000 : false;
    },
  });

  // Stats derived from runs
  const stats = {
    total: runs.data?.length ?? 0,
    pending: runs.data?.filter((r) => r.status === "pending").length ?? 0,
    running: runs.data?.filter((r) => r.status === "running").length ?? 0,
    success: runs.data?.filter((r) => r.status === "success").length ?? 0,
    failed: runs.data?.filter((r) => r.status === "failed").length ?? 0,
  };
  const done = stats.success + stats.failed;
  const pct = stats.total > 0 ? Math.round((done / stats.total) * 100) : 0;
  const isComplete = stats.total > 0 && done === stats.total;
  const isActive = stats.pending > 0 || stats.running > 0;

  // Publications count for this date
  const pubCount = useQuery({
    queryKey: ["pipeline-pub-count", date],
    enabled: done > 0,
    queryFn: async () => {
      const { count } = await supabase
        .from("publications")
        .select("id", { count: "exact", head: true })
        .eq("publication_date", date);
      return count ?? 0;
    },
    refetchInterval: isActive ? 3000 : false,
  });

  // Matches found for this user on this date
  const matchResults = useQuery({
    queryKey: ["pipeline-matches", date, user?.id],
    enabled: done > 0 && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("id, excerpt, ai_summary, ai_category, created_at, terms(label), publications!inner(title, url, sources(name))")
        .eq("publication_date", date)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as MatchResult[];
    },
    refetchInterval: isActive ? 5000 : false,
  });

  useEffect(() => {
    if (isComplete) setRunning(false);
  }, [isComplete]);

  const startRun = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("scrape-orchestrator", {
        body: { force: true, date },
      });
      if (error) throw new Error(error.message);
      return data as { total: number; enqueued: number; skipped: number };
    },
    onSuccess: (data) => {
      toast.success(`${data.enqueued} fontes enfileiradas para ${date}`);
      setRunning(true);
      runs.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pesquisa manual</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dispara o pipeline de scraping para qualquer data e acompanha o progresso em tempo real.
        </p>
      </div>

      {/* Controls */}
      <Card className="max-w-xl">
        <CardContent className="flex flex-wrap items-end gap-4 p-5">
          <div className="flex-1 min-w-48">
            <Label htmlFor="run-date" className="mb-1.5 block text-sm">
              Data da pesquisa
            </Label>
            <Input
              id="run-date"
              type="date"
              value={date}
              max={today()}
              onChange={(e) => {
                setDate(toWeekday(e.target.value));
                setRunning(false);
              }}
            />
            {(() => {
              const d = new Date(date + "T12:00:00Z");
              const dow = d.getUTCDay();
              return dow === 5 && (new Date().getUTCDay() === 6 || new Date().getUTCDay() === 0) ? (
                <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                  Fim de semana detectado — usando sexta-feira ({date})
                </p>
              ) : null;
            })()}
          </div>
          <Button
            onClick={() => startRun.mutate()}
            disabled={startRun.isPending || isActive}
            size="lg"
            className="gap-2"
          >
            {startRun.isPending || isActive ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PlayCircle className="h-4 w-4" />
            )}
            {isActive ? "Rodando..." : "Iniciar pesquisa"}
          </Button>
        </CardContent>
      </Card>

      {/* Progress section */}
      {stats.total > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span>
                Progresso —{" "}
                {format(new Date(date + "T12:00:00"), "dd 'de' MMMM yyyy", { locale: ptBR })}
              </span>
              <span className="text-sm font-normal text-muted-foreground">
                {done}/{stats.total} fontes
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={pct} className="h-2.5" />

            <div className="flex flex-wrap gap-3 text-sm">
              {stats.pending > 0 && (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Hourglass className="h-3.5 w-3.5" /> {stats.pending} aguardando
                </span>
              )}
              {stats.running > 0 && (
                <span className="flex items-center gap-1.5 text-blue-600">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> {stats.running} rodando
                </span>
              )}
              {stats.success > 0 && (
                <span className="flex items-center gap-1.5 text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {stats.success} concluídas
                </span>
              )}
              {stats.failed > 0 && (
                <span className="flex items-center gap-1.5 text-destructive">
                  <XCircle className="h-3.5 w-3.5" /> {stats.failed} falharam
                </span>
              )}
            </div>

            {/* Per-source table */}
            <div className="divide-y rounded-md border text-sm">
              {(runs.data ?? []).map((r) => (
                <RunSourceRow key={r.id} run={r} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results section */}
      {done > 0 && (
        <div className="space-y-4">
          {/* KPIs + busca rápida */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold">
              Resultados —{" "}
              <span className="font-normal text-muted-foreground">
                {format(new Date(date + "T12:00:00"), "dd 'de' MMMM", { locale: ptBR })}
              </span>
            </h2>
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link to="/app/search" search={{ q: "", since: date, until: date }}>
                <Search className="h-3.5 w-3.5" />
                Buscar nos resultados
              </Link>
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiCard
              label="Publicações ingeridas"
              value={pubCount.data ?? "—"}
              icon={<FileText className="h-4 w-4 text-muted-foreground" />}
            />
            <KpiCard
              label="Matches encontrados"
              value={matchResults.data?.length ?? "—"}
              icon={<Tag className="h-4 w-4 text-muted-foreground" />}
            />
            <KpiCard
              label="Fontes com conteúdo"
              value={stats.success > 0
                ? (runs.data ?? []).filter((r) => r.status === "success" && r.pages_processed > 0).length
                : "—"}
              icon={<CheckCircle2 className="h-4 w-4 text-muted-foreground" />}
            />
          </div>

          {/* Matches list */}
          {(matchResults.data?.length ?? 0) > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Matches encontrados{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    (seus termos · {date})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {matchResults.data!.map((m) => (
                  <MatchResultRow key={m.id} m={m} />
                ))}
              </CardContent>
            </Card>
          ) : isComplete ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Nenhum match para seus termos — use a busca livre para explorar o conteúdo ingerido.
                </p>
                <Button asChild variant="outline" size="sm" className="gap-2">
                  <Link to="/app/search" search={{ q: "", since: date, until: date }}>
                    <Search className="h-3.5 w-3.5" />
                    Buscar nesta edição
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}

function RunSourceRow({ run }: { run: RunRow }) {
  const src = run.sources;
  const statusIcon =
    run.status === "success" ? (
      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
    ) : run.status === "failed" ? (
      <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
    ) : run.status === "running" ? (
      <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin shrink-0" />
    ) : (
      <Hourglass className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
    );

  const durationMs =
    run.started_at && run.finished_at
      ? new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()
      : null;

  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      {statusIcon}
      <span className="flex-1 truncate font-medium text-sm">{src?.name ?? src?.code ?? "—"}</span>
      <Badge variant="outline" className="text-[10px] font-mono shrink-0">
        {src?.scraper_adapter}
      </Badge>
      {run.status === "success" && (
        <span className="text-xs text-muted-foreground shrink-0">
          {run.pages_processed} pág.
        </span>
      )}
      {durationMs !== null && (
        <span className="text-[10px] text-muted-foreground shrink-0">
          {(durationMs / 1000).toFixed(1)}s
        </span>
      )}
      {run.status === "failed" && run.error && (
        <span
          className="max-w-xs truncate text-[10px] text-destructive shrink-0"
          title={run.error}
        >
          {run.error}
        </span>
      )}
      {run.status === "running" && (
        <span className="text-[10px] text-blue-500 shrink-0">
          <Clock className="inline h-3 w-3 mr-0.5" />
          em andamento
        </span>
      )}
    </div>
  );
}

function MatchResultRow({ m }: { m: MatchResult }) {
  const pub = m.publications;
  return (
    <div className="flex items-start gap-3 rounded-md border p-3 text-sm">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-medium">{m.terms?.label ?? "—"}</span>
          {m.ai_category && (
            <Badge variant="secondary" className="text-[10px]">
              {m.ai_category}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">{pub?.sources?.name}</span>
        </div>
        {m.ai_summary ? (
          <p className="text-xs text-muted-foreground line-clamp-2">{m.ai_summary}</p>
        ) : (
          <p className="text-xs text-muted-foreground line-clamp-2">{m.excerpt}</p>
        )}
      </div>
      {pub?.url && (
        <a
          href={pub.url}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}

function KpiCard({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        </div>
        {icon}
      </CardContent>
    </Card>
  );
}
