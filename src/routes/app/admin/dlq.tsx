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

export const Route = createFileRoute("/app/admin/dlq")({
  component: DLQPage,
});

function DLQPage() {
  const { user, loading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useIsAdminWithLoading();
  const qc = useQueryClient();

  const items = useQuery({
    queryKey: ["admin-dlq"],
    enabled: !!user && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select(
          "id, channel, attempts, error, updated_at, matches(terms(label), publications(sources(name)))",
        )
        .in("status", ["dlq", "failed"])
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as Array<{
        id: string;
        channel: string;
        attempts: number;
        error: string | null;
        updated_at: string;
        matches: {
          terms: { label: string } | null;
          publications: { sources: { name: string } | null } | null;
        } | null;
      }>;
    },
    refetchInterval: 30_000,
  });

  const retry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("admin_retry_notification", { _id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Re-enfileirado");
      qc.invalidateQueries({ queryKey: ["admin-dlq"] });
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
        <h1 className="text-2xl font-semibold tracking-tight">DLQ — Notificações falhas</h1>
      </div>

      <Card>
        <CardContent className="p-0">
          {items.isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Carregando...</p>
          ) : !items.data?.length ? (
            <p className="p-6 text-sm text-muted-foreground">
              Nenhuma notificação na DLQ. Tudo OK.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Última tentativa</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Termo</TableHead>
                  <TableHead>Fonte</TableHead>
                  <TableHead className="text-right">Tentativas</TableHead>
                  <TableHead>Erro</TableHead>
                  <TableHead className="w-24 text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.data.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell className="text-xs">
                      {format(new Date(n.updated_at), "dd/MM HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize text-[10px]">
                        {n.channel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{n.matches?.terms?.label ?? "—"}</TableCell>
                    <TableCell className="text-xs">
                      {n.matches?.publications?.sources?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">{n.attempts}</TableCell>
                    <TableCell
                      className="max-w-xs truncate text-xs text-destructive"
                      title={n.error ?? undefined}
                    >
                      {n.error ?? ""}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => retry.mutate(n.id)}
                        title="Re-enfileirar"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
