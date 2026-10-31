import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Check, ChevronDown, Search as SearchIcon, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MatchCard, type MatchRow, humanizeDate } from "@/components/match-card";

export const Route = createFileRoute("/app/alerts")({
  component: AlertsPage,
});

const CATEGORIES = [
  { value: "all", label: "Todas categorias" },
  { value: "licitacao", label: "Licitação" },
  { value: "nomeacao", label: "Nomeação" },
  { value: "exoneracao", label: "Exoneração" },
  { value: "processo", label: "Processo" },
  { value: "multa", label: "Multa" },
  { value: "homologacao", label: "Homologação" },
  { value: "outro", label: "Outro" },
] as const;

const STATUS_FILTERS = [
  { value: "unread", label: "Não lidos" },
  { value: "all", label: "Todos" },
  { value: "flagged", label: "Importantes" },
  { value: "archived", label: "Arquivados" },
  { value: "fp", label: "Falsos positivos" },
] as const;

const DATE_RANGES = [
  { value: "1d", label: "Hoje", days: 1 },
  { value: "7d", label: "Últimos 7 dias", days: 7 },
  { value: "30d", label: "Últimos 30 dias", days: 30 },
  { value: "90d", label: "Últimos 90 dias", days: 90 },
  { value: "all", label: "Tudo", days: null as number | null },
] as const;

const SORT_OPTIONS = [
  { value: "newest", label: "Mais recentes" },
  { value: "oldest", label: "Mais antigos" },
  { value: "confidence", label: "Maior confiança" },
] as const;

function AlertsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [category, setCategory] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("unread");
  const [dateRange, setDateRange] = useState<string>("30d");
  const [sort, setSort] = useState<string>("newest");
  const [search, setSearch] = useState<string>("");
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<string>("all");

  // Auxiliar queries: sources e termos disponíveis (pra popular os filtros)
  const sourcesQ = useQuery({
    queryKey: ["alerts-filter-sources", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sources")
        .select("id, code, name")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const termsQ = useQuery({
    queryKey: ["alerts-filter-terms", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("terms")
        .select("id, label")
        .eq("user_id", user!.id)
        .is("deleted_at", null)
        .order("label");
      if (error) throw error;
      return data ?? [];
    },
  });

  const matches = useQuery({
    queryKey: [
      "matches",
      user?.id,
      category,
      statusFilter,
      dateRange,
      sort,
      search,
      selectedSources.join(","),
      selectedTerm,
    ],
    enabled: !!user?.id,
    queryFn: async () => {
      let q = supabase
        .from("matches")
        .select(
          "id, publication_id, publication_date, excerpt, ai_category, ai_summary, ai_confidence, ai_decision_reason, ai_processed_at, is_false_positive, created_at, read_at, flagged, archived_at, user_note, term_id, term_label_snapshot, terms(label), publications!inner(publication_date, title, url, source_id, sources(name, code))",
        )
        .limit(200);

      // Ordenação
      if (sort === "newest") q = q.order("created_at", { ascending: false });
      else if (sort === "oldest") q = q.order("created_at", { ascending: true });
      else if (sort === "confidence")
        q = q.order("ai_confidence", { ascending: false, nullsFirst: false });

      // Categoria
      if (category !== "all") q = q.eq("ai_category", category as never);

      // Termo
      if (selectedTerm !== "all") q = q.eq("term_id", selectedTerm);

      // Fontes (filtro nas publications relacionadas)
      if (selectedSources.length > 0) {
        q = q.in("publications.source_id", selectedSources);
      }

      // Status
      if (statusFilter === "unread")
        q = q.is("read_at", null).is("archived_at", null).eq("is_false_positive", false);
      if (statusFilter === "all") q = q.is("archived_at", null).eq("is_false_positive", false);
      if (statusFilter === "flagged") q = q.eq("flagged", true).is("archived_at", null);
      if (statusFilter === "archived") q = q.not("archived_at", "is", null);
      if (statusFilter === "fp") q = q.eq("is_false_positive", true);

      // Data
      const range = DATE_RANGES.find((r) => r.value === dateRange);
      if (range?.days) {
        const since = new Date(Date.now() - range.days * 86400_000).toISOString();
        q = q.gte("created_at", since);
      }

      // Busca textual (excerpt OR ai_summary)
      const term = search.trim();
      if (term) {
        q = q.or(`excerpt.ilike.%${term}%,ai_summary.ilike.%${term}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as MatchRow[];
    },
  });

  // Agrupa por data de publicação
  const grouped = useMemo(() => {
    type MatchItem = NonNullable<typeof matches.data>[number];
    if (!matches.data) return [] as { key: string; label: string; items: MatchItem[] }[];
    const map = new Map<string, MatchItem[]>();
    for (const m of matches.data) {
      const d = m.publications?.publication_date ?? m.created_at.slice(0, 10);
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(m);
    }
    return Array.from(map.entries())
      .sort((a, b) => (sort === "oldest" ? a[0].localeCompare(b[0]) : b[0].localeCompare(a[0])))
      .map(([key, items]) => ({
        key,
        label: humanizeDate(key),
        items,
      }));
  }, [matches.data, sort]);

  const activeFilters = [
    category !== "all" && CATEGORIES.find((c) => c.value === category)?.label,
    selectedTerm !== "all" && termsQ.data?.find((t) => t.id === selectedTerm)?.label,
    selectedSources.length > 0 && `${selectedSources.length} fonte(s)`,
    search.trim() && `"${search.trim()}"`,
  ].filter(Boolean) as string[];

  const clearAll = () => {
    setCategory("all");
    setStatusFilter("unread");
    setDateRange("30d");
    setSort("newest");
    setSearch("");
    setSelectedSources([]);
    setSelectedTerm("all");
  };

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
      qc.invalidateQueries({ queryKey: ["matches"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Histórico de alertas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tudo que foi encontrado nos diários sobre seus termos cadastrados.
        </p>
      </div>

      {/* Busca textual */}
      <div className="relative max-w-xl">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar no conteúdo ou resumo do alerta..."
          className="pl-9"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
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
            {STATUS_FILTERS.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedTerm} onValueChange={setSelectedTerm}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Termo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os termos</SelectItem>
            {termsQ.data?.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Multi-select fontes */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              {selectedSources.length > 0
                ? `${selectedSources.length} fonte${selectedSources.length === 1 ? "" : "s"}`
                : "Todas as fontes"}
              <ChevronDown className="ml-2 h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <div className="max-h-72 overflow-auto p-1">
              {sourcesQ.data?.map((s) => {
                const checked = selectedSources.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() =>
                      setSelectedSources((prev) =>
                        checked ? prev.filter((x) => x !== s.id) : [...prev, s.id],
                      )
                    }
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent"
                  >
                    <span
                      className={`grid h-3.5 w-3.5 place-items-center rounded border ${checked ? "border-primary bg-primary text-primary-foreground" : "border-input"}`}
                    >
                      {checked && <Check className="h-2.5 w-2.5" />}
                    </span>
                    <span className="truncate">{s.name}</span>
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                      {s.code}
                    </span>
                  </button>
                );
              })}
            </div>
            {selectedSources.length > 0 && (
              <div className="flex border-t p-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-full text-xs"
                  onClick={() => setSelectedSources([])}
                >
                  Limpar seleção
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Chips de filtros ativos + total */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium">
          {matches.data?.length ?? 0} resultado{(matches.data?.length ?? 0) === 1 ? "" : "s"}
        </span>
        {activeFilters.length > 0 && (
          <>
            <span className="text-muted-foreground">·</span>
            {activeFilters.map((f, i) => (
              <Badge key={i} variant="secondary" className="font-normal">
                {f}
              </Badge>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={clearAll}
            >
              Limpar filtros
            </Button>
          </>
        )}
      </div>

      {matches.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !matches.data || matches.data.length === 0 ? (
        <Card>
          <CardContent className="grid place-items-center gap-2 p-12 text-center">
            <p className="font-medium">Nenhum alerta encontrado</p>
            <p className="text-sm text-muted-foreground">
              {activeFilters.length > 0
                ? "Nenhum resultado para os filtros atuais. Tente ampliar a busca."
                : "Quando o pipeline encontrar matches dos seus termos, eles aparecerão aqui."}
            </p>
            {activeFilters.length > 0 && (
              <Button variant="outline" size="sm" onClick={clearAll} className="mt-2">
                Limpar filtros
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <section key={group.key} className="space-y-3">
              <div className="sticky top-14 z-[5] -mx-1 flex items-center gap-2 bg-background/95 px-1 py-1 backdrop-blur">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </h2>
                <span className="text-[10px] text-muted-foreground">
                  · {group.items.length} alerta{group.items.length === 1 ? "" : "s"}
                </span>
              </div>
              {group.items.map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
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

// MatchCard, MatchRow, humanizeDate são re-exportados de @/components/match-card.

