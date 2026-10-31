import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Save, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MatchCard, type MatchRow, humanizeDate } from "@/components/match-card";

export const Route = createFileRoute("/app/radar/$termId")({
  component: RadarDetailPage,
});

const DATE_RANGES = [
  { value: "7d", label: "Últimos 7 dias", days: 7 },
  { value: "30d", label: "Últimos 30 dias", days: 30 },
  { value: "90d", label: "Últimos 90 dias", days: 90 },
  { value: "all", label: "Tudo", days: null as number | null },
] as const;

const STATUS_FILTERS = [
  { value: "unread", label: "Não lidos" },
  { value: "all", label: "Todos" },
  { value: "flagged", label: "Importantes" },
  { value: "archived", label: "Arquivados" },
  { value: "fp", label: "Falsos positivos" },
] as const;

function RadarDetailPage() {
  const { termId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [dateRange, setDateRange] = useState<string>("30d");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  // Carrega o radar
  const termQ = useQuery({
    queryKey: ["radar-detail", termId, user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("terms")
        .select(
          "id, label, pattern, match_type, context_hint, notes, active, tags, term_sources(source_id, sources(name, code))",
        )
        .eq("id", termId)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const matchesKey = useMemo(
    () => ["radar-matches", termId, dateRange, statusFilter, search] as const,
    [termId, dateRange, statusFilter, search],
  );

  const matchesQ = useQuery({
    queryKey: matchesKey as unknown as readonly unknown[],
    enabled: !!user?.id,
    queryFn: async () => {
      let q = supabase
        .from("matches")
        .select(
          "id, publication_id, publication_date, excerpt, ai_category, ai_summary, ai_confidence, ai_decision_reason, ai_processed_at, is_false_positive, created_at, read_at, flagged, archived_at, user_note, term_id, term_label_snapshot, terms(label), publications(publication_date, title, url, source_id, sources(name, code))",
        )
        .eq("term_id", termId)
        .order("created_at", { ascending: false })
        .limit(500);

      if (statusFilter === "unread")
        q = q.is("read_at", null).is("archived_at", null).eq("is_false_positive", false);
      if (statusFilter === "all") q = q.is("archived_at", null).eq("is_false_positive", false);
      if (statusFilter === "flagged") q = q.eq("flagged", true).is("archived_at", null);
      if (statusFilter === "archived") q = q.not("archived_at", "is", null);
      if (statusFilter === "fp") q = q.eq("is_false_positive", true);

      const range = DATE_RANGES.find((r) => r.value === dateRange);
      if (range?.days) {
        const since = new Date(Date.now() - range.days * 86400_000).toISOString();
        q = q.gte("created_at", since);
      }

      const term = search.trim();
      if (term) q = q.or(`excerpt.ilike.%${term}%,ai_summary.ilike.%${term}%`);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as MatchRow[];
    },
  });

  // KPIs (independentes do filtro de status; só pra dar visão geral)
  const statsQ = useQuery({
    queryKey: ["radar-stats", termId, user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const since30 = new Date(Date.now() - 30 * 86400_000).toISOString();
      const cut7 = Date.now() - 7 * 86400_000;
      const { data, error } = await supabase
        .from("matches")
        .select("created_at, ai_confidence, is_false_positive")
        .eq("term_id", termId)
        .gte("created_at", since30);
      if (error) throw error;
      let d7 = 0,
        d30 = 0,
        fp = 0;
      let confSum = 0,
        confCount = 0;
      for (const m of data ?? []) {
        const row = m as { created_at: string; ai_confidence: number | null; is_false_positive: boolean };
        if (row.is_false_positive) {
          fp++;
          continue;
        }
        d30++;
        if (new Date(row.created_at).getTime() >= cut7) d7++;
        if (typeof row.ai_confidence === "number") {
          confSum += row.ai_confidence;
          confCount++;
        }
      }
      return {
        d7,
        d30,
        fp,
        avgConfidence: confCount > 0 ? confSum / confCount : null,
      };
    },
  });

  // Nota com auto-save (debounce)
  const [noteDraft, setNoteDraft] = useState<string>("");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (termQ.data && !dirty) {
      setNoteDraft((termQ.data as { notes: string | null }).notes ?? "");
    }
  }, [termQ.data, dirty]);

  const saveNote = useMutation({
    mutationFn: async (value: string) => {
      const { error } = await supabase
        .from("terms")
        .update({ notes: value.trim() ? value.trim() : null })
        .eq("id", termId);
      if (error) throw error;
    },
    onSuccess: () => {
      setSavedAt(new Date());
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["radar-detail", termId] });
      qc.invalidateQueries({ queryKey: ["terms"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => saveNote.mutate(noteDraft), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteDraft, dirty]);

  const setFalsePositive = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase
        .from("matches")
        .update({ is_false_positive: value })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marcação atualizada");
      qc.invalidateQueries({ queryKey: ["radar-matches", termId] });
      qc.invalidateQueries({ queryKey: ["radar-stats", termId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Agrupa por data de publicação
  const grouped = useMemo(() => {
    if (!matchesQ.data) return [] as { key: string; label: string; items: MatchRow[] }[];
    const map = new Map<string, MatchRow[]>();
    for (const m of matchesQ.data) {
      const d = m.publications?.publication_date ?? m.created_at.slice(0, 10);
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(m);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, items]) => ({ key, label: humanizeDate(key), items }));
  }, [matchesQ.data]);

  if (termQ.isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando radar...</p>;
  }
  if (!termQ.data) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Radar não encontrado.</p>
        <Button variant="outline" size="sm" onClick={() => navigate({ to: "/app/topics" })}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar aos radares
        </Button>
      </div>
    );
  }

  const term = termQ.data as {
    id: string;
    label: string;
    pattern: string;
    match_type: "literal" | "regex" | "cnpj";
    context_hint: string | null;
    notes: string | null;
    active: boolean;
    tags: string[] | null;
    term_sources: Array<{ source_id: string; sources: { name: string; code: string } | null }>;
  };
  const sourceList = (term.term_sources ?? [])
    .map((ts) => ts.sources)
    .filter(Boolean) as Array<{ name: string; code: string }>;
  const visibleTags = (term.tags ?? []).filter((t) => t !== "_entidade");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          to="/app/topics"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Radares
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{term.label}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline" className="capitalize">
                {term.match_type}
              </Badge>
              {term.active ? (
                <Badge className="bg-emerald-600 text-white">ativo</Badge>
              ) : (
                <Badge variant="secondary">pausado</Badge>
              )}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                {term.pattern}
              </code>
              {visibleTags.map((tg) => (
                <span
                  key={tg}
                  className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                >
                  #{tg}
                </span>
              ))}
            </div>
            {term.context_hint && (
              <p className="mt-2 text-xs italic text-muted-foreground">💡 {term.context_hint}</p>
            )}
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/app/topics">
              <Pencil className="mr-2 h-3.5 w-3.5" /> Editar radar
            </Link>
          </Button>
        </div>
      </div>

      {/* Nota persistente */}
      <Card>
        <CardContent className="space-y-2 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium">
              <StickyNote className="h-3.5 w-3.5 text-primary" />
              Nota do radar
            </div>
            <div className="text-[10px] text-muted-foreground">
              {saveNote.isPending ? (
                "Salvando..."
              ) : dirty ? (
                "Editando..."
              ) : savedAt ? (
                <span className="inline-flex items-center gap-1">
                  <Save className="h-2.5 w-2.5" /> Salvo
                </span>
              ) : (
                "Salvo automaticamente"
              )}
            </div>
          </div>
          <Textarea
            value={noteDraft}
            onChange={(e) => {
              setNoteDraft(e.target.value);
              setDirty(true);
            }}
            placeholder="Anotações sobre este radar: contexto, instruções para a equipe, lembretes..."
            rows={4}
            className="text-sm"
          />
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-4">
        <KPI label="Matches 7d" value={statsQ.data?.d7 ?? 0} highlight />
        <KPI label="Matches 30d" value={statsQ.data?.d30 ?? 0} />
        <KPI
          label="Confiança média"
          value={
            statsQ.data?.avgConfidence != null
              ? `${Math.round(statsQ.data.avgConfidence * 100)}%`
              : "—"
          }
        />
        <KPI label="Fontes monitoradas" value={sourceList.length} />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar no conteúdo dos matches..."
          className="max-w-sm"
        />
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">
          {matchesQ.data?.length ?? 0} resultado{(matchesQ.data?.length ?? 0) === 1 ? "" : "s"}
        </span>
      </div>

      {/* Matches */}
      {matchesQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando matches...</p>
      ) : !matchesQ.data || matchesQ.data.length === 0 ? (
        <Card>
          <CardContent className="grid place-items-center gap-2 p-12 text-center">
            <p className="font-medium">Nenhum resultado para este radar</p>
            <p className="text-sm text-muted-foreground">
              Ajuste os filtros ou aguarde o próximo ciclo do pipeline.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map((g) => (
            <section key={g.key} className="space-y-3">
              <div className="sticky top-14 z-[5] -mx-1 flex items-center gap-2 bg-background/95 px-1 py-1 backdrop-blur">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {g.label}
                </h2>
                <span className="text-[10px] text-muted-foreground">
                  · {g.items.length} match{g.items.length === 1 ? "" : "es"}
                </span>
              </div>
              {g.items.map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  linkTerm={false}
                  invalidateKeys={[
                    ["radar-matches", termId],
                    ["radar-stats", termId],
                  ]}
                  onMark={(value) => setFalsePositive.mutate({ id: m.id, value })}
                />
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function KPI({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${highlight ? "text-primary" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
