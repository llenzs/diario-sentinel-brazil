import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RefreshCw, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdminWithLoading } from "@/hooks/use-is-admin";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/app/admin/runs")({
  component: RunsPage,
});

function RunsPage() {
  const { user, loading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useIsAdminWithLoading();
  const qc = useQueryClient();

  const runs = useQuery({
    queryKey: ["admin-scrape-runs"],
    enabled: !!user && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scrape_runs")
        .select(
          "id, publication_date, status, pages_processed, error, started_at, finished_at, sources(name, code)",
        )
        .order("publication_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 15_000,
  });

  const retry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("admin_retry_scrape_run", { _id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Re-enfileirado");
      qc.invalidateQueries({ queryKey: ["admin-scrape-runs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading || adminLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!user) return <Navigate to="/login" />;
  if (!isAdmin) return <Navigate to="/app" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/app/admin">
            <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Scrape runs</h1>
      </div>

      <Card>
        <CardContent className="p-0">
          {runs.isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Carregando...</p>
          ) : !runs.data?.length ? (
            <p className="p-6 text-sm text-muted-foreground">Sem runs ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Fonte</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Páginas</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Erro</TableHead>
                  <TableHead className="w-24 text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.data.map((r) => {
                  const duration = duration_(r.started_at, r.finished_at);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">
                        {format(new Date(r.publication_date), "dd/MM", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-xs">{r.sources?.code ?? "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {r.pages_processed}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{duration}</TableCell>
                      <TableCell
                        className="max-w-xs truncate text-xs text-destructive"
                        title={r.error ?? undefined}
                      >
                        {r.error ?? ""}
                      </TableCell>
                      <TableCell className="text-right">
                        {(r.status === "failed" || r.status === "pending") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => retry.mutate(r.id)}
                            title="Re-enfileirar"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map = {
    success: { cls: "bg-emerald-600 text-white", label: "OK" },
    running: { cls: "bg-blue-600 text-white", label: "Rodando" },
    pending: { cls: "", label: "Pending", variant: "secondary" as const },
    failed: { cls: "", label: "Falhou", variant: "destructive" as const },
  } as const;
  const cfg = map[status as keyof typeof map] ?? {
    cls: "",
    label: status,
    variant: "outline" as const,
  };
  if ("variant" in cfg) return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
  return <Badge className={cfg.cls}>{cfg.label}</Badge>;
}

function duration_(start: string | null, end: string | null): string {
  if (!start || !end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}min`;
}
