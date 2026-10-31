import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, PlayCircle, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdminWithLoading } from "@/hooks/use-is-admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/app/admin/cron")({
  component: CronPage,
});

type Job = {
  jobid: number;
  jobname: string;
  schedule: string;
  command: string;
  active: boolean;
  last_run_at: string | null;
  last_status: string | null;
};

const PRESETS: Array<{ label: string; cron: string }> = [
  { label: "A cada minuto", cron: "* * * * *" },
  { label: "A cada 2 minutos", cron: "*/2 * * * *" },
  { label: "A cada 5 minutos", cron: "*/5 * * * *" },
  { label: "A cada 15 minutos", cron: "*/15 * * * *" },
  { label: "A cada 30 minutos", cron: "*/30 * * * *" },
  { label: "A cada hora", cron: "0 * * * *" },
  { label: "Diário às 3h", cron: "0 3 * * *" },
  { label: "Semanal (dom 4h)", cron: "0 4 * * 0" },
];

function CronPage() {
  const { user, loading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useIsAdminWithLoading();

  if (loading || adminLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!user) return <Navigate to="/login" />;
  if (!isAdmin) return <Navigate to="/app" />;

  return <CronContent />;
}

function CronContent() {
  const qc = useQueryClient();

  const jobs = useQuery({
    queryKey: ["admin-cron-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_cron_jobs");
      if (error) throw error;
      return (data ?? []) as Job[];
    },
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/app/admin">
            <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Cron jobs</h1>
      </div>

      <Card className="border-dashed bg-muted/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sintaxe</CardTitle>
          <CardDescription className="text-xs">
            <span className="font-mono">min hora dia mês dia-semana</span> · Use presets ou cole uma
            expressão crontab. Exemplos: <span className="font-mono">*/30 * * * *</span> = a cada
            30min, <span className="font-mono">0 3 * * *</span> = 03:00 todo dia.
          </CardDescription>
        </CardHeader>
      </Card>

      {jobs.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="space-y-3">
          {(jobs.data ?? []).map((job) => (
            <JobCard
              key={job.jobid}
              job={job}
              onChanged={() => qc.invalidateQueries({ queryKey: ["admin-cron-jobs"] })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function JobCard({ job, onChanged }: { job: Job; onChanged: () => void }) {
  const [schedule, setSchedule] = useState(job.schedule);
  const isPipelineJob = [
    "scrape-orchestrator-30m",
    "ai-classifier-2m",
    "notify-dispatcher-1m",
  ].includes(job.jobname);

  const saveSchedule = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_update_cron_schedule", {
        _jobname: job.jobname,
        _schedule: schedule.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Schedule atualizado");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async (active: boolean) => {
      const { error } = await supabase.rpc("admin_set_cron_active", {
        _jobname: job.jobname,
        _active: active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runNow = useMutation({
    mutationFn: async () => {
      // Dispatch via direct trigger when available
      const map: Record<string, string> = {
        "scrape-orchestrator-30m": "admin_run_orchestrator",
        "ai-classifier-2m": "admin_trigger_classifier",
        "notify-dispatcher-1m": "admin_trigger_dispatcher",
      };
      const rpc = map[job.jobname];
      if (rpc) {
        const { error } = await supabase.rpc(rpc as never);
        if (error) throw error;
      } else {
        toast.info("Esse job não tem disparo manual — vai rodar no próximo schedule");
      }
    },
    onSuccess: () => toast.success("Disparado"),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="font-mono text-sm">{job.jobname}</CardTitle>
            <CardDescription className="mt-1 text-xs">
              {isPipelineJob && (
                <Badge variant="outline" className="mr-2 text-[10px]">
                  pipeline
                </Badge>
              )}
              {job.last_run_at ? (
                <>
                  Última execução:{" "}
                  {format(new Date(job.last_run_at), "dd/MM HH:mm", { locale: ptBR })}
                  {job.last_status && (
                    <Badge
                      variant={job.last_status === "succeeded" ? "default" : "destructive"}
                      className="ml-2 text-[10px]"
                    >
                      {job.last_status}
                    </Badge>
                  )}
                </>
              ) : (
                "Nunca executou"
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={job.active}
              onCheckedChange={(v) => toggleActive.mutate(v)}
              disabled={toggleActive.isPending}
            />
            <span className="text-xs text-muted-foreground">
              {job.active ? "Ativo" : "Pausado"}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
            className="max-w-xs font-mono text-sm"
          />
          <Button
            size="sm"
            onClick={() => saveSchedule.mutate()}
            disabled={saveSchedule.isPending || schedule.trim() === job.schedule}
          >
            <Save className="mr-1 h-3.5 w-3.5" /> Salvar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => runNow.mutate()}
            disabled={runNow.isPending}
          >
            <PlayCircle className="mr-1 h-3.5 w-3.5" /> Rodar agora
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.cron}
              type="button"
              onClick={() => setSchedule(p.cron)}
              className="rounded-md border bg-muted/40 px-2 py-1 text-[10px] hover:bg-accent"
            >
              {p.label} <span className="font-mono text-muted-foreground">{p.cron}</span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
