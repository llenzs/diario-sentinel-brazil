import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FileSearch, Gavel, Plus, Regex, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  CATEGORY_TAG,
  EmptyState,
  TermCard,
  TermDialog,
  TermRow,
  TermTemplate,
  tagColor,
  useTermRadar,
} from "@/components/term-radar";

export const Route = createFileRoute("/app/topics")({
  component: TopicsPage,
});

const TOPIC_TEMPLATES: TermTemplate[] = [
  {
    id: "licitacao",
    icon: Gavel,
    title: "Licitações",
    description: "Monitora abertura de pregões, concorrências e tomadas de preço.",
    label: "Licitações",
    pattern: "licitação",
    match_type: "literal",
    context_hint: "setor de interesse, órgão-alvo, valor mínimo",
  },
  {
    id: "contrato",
    icon: FileSearch,
    title: "Contratos públicos",
    description: "Monitora publicação de extratos de contratos administrativos.",
    label: "Contratos",
    pattern: "extrato de contrato",
    match_type: "literal",
    context_hint: "tipo de serviço ou obra, órgão contratante",
  },
  {
    id: "regex-custom",
    icon: Regex,
    title: "Padrão regex",
    description: "Buscas avançadas com expressão regular para padrões complexos.",
    label: "Padrão customizado",
    pattern: "",
    match_type: "regex",
    context_hint: "descreva o que você quer encontrar",
  },
];

function TopicsPage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TermRow | null>(null);
  const [template, setTemplate] = useState<TermTemplate | null>(null);
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "paused">("all");
  const [filterType, setFilterType] = useState<"all" | "literal" | "regex" | "cnpj">("all");
  const [filterTag, setFilterTag] = useState<string | null>(null);

  const { sources, sourcesById, terms, termsLoading, termStats, allTags, saveTerm, toggleActive, deleteTerm } =
    useTermRadar("tema");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return terms.filter((t) => {
      if (filterStatus === "active" && !t.active) return false;
      if (filterStatus === "paused" && t.active) return false;
      if (filterType !== "all" && t.match_type !== filterType) return false;
      if (filterTag && !(t.tags ?? []).filter((x) => x !== CATEGORY_TAG).includes(filterTag))
        return false;
      if (q && !t.label.toLowerCase().includes(q) && !t.pattern.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [terms, query, filterStatus, filterType, filterTag]);

  const activeCount = terms.filter((t) => t.active).length;
  const totalMatches7d = Array.from(termStats?.values() ?? []).reduce((a, b) => a + b.d7, 0);

  const openNew = () => {
    setEditing(null);
    setTemplate(null);
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Radar Temático</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitore palavras-chave, licitações, temas e padrões regex nos Diários Oficiais.
          </p>
        </div>
        <Button size="lg" onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" /> Novo radar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Temas monitorados
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{terms.length}</p>
          <p className="text-[11px] text-muted-foreground">{activeCount} ativos</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Matches (últimos 7d)
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{totalMatches7d}</p>
          <p className="text-[11px] text-muted-foreground">soma de todos os temas</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Fontes monitoradas
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{sources.length}</p>
          <p className="text-[11px] text-muted-foreground">disponíveis pra rastrear</p>
        </div>
      </div>

      {/* Templates */}
      {terms.length === 0 && (
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Comece por um template</CardTitle>
            <CardDescription>
              Clique pra criar seu primeiro radar temático. Você ajusta os detalhes depois.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-3">
            {TOPIC_TEMPLATES.map((tpl) => {
              const Icon = tpl.icon;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setTemplate(tpl);
                    setOpen(true);
                  }}
                  className="flex items-start gap-3 rounded-md border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/30"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{tpl.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{tpl.description}</p>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Filtros */}
      {terms.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:w-72 sm:flex-none">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar tema..."
              className="pl-8"
            />
          </div>
          <div className="flex gap-1 rounded-md border p-0.5">
            {(["all", "active", "paused"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`rounded-sm px-3 py-1 text-xs transition-colors ${
                  filterStatus === s
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent"
                }`}
              >
                {s === "all" ? "Todos" : s === "active" ? "Ativos" : "Pausados"}
              </button>
            ))}
          </div>
          <div className="flex gap-1 rounded-md border p-0.5">
            {(["all", "literal", "regex", "cnpj"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterType(s)}
                className={`rounded-sm px-3 py-1 text-xs capitalize transition-colors ${
                  filterType === s
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent"
                }`}
              >
                {s === "all" ? "Todos tipos" : s}
              </button>
            ))}
          </div>
          <p className="ml-auto text-xs text-muted-foreground">
            {filtered.length} de {terms.length}
          </p>
        </div>
      )}

      {/* Tag filter */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Tags:</span>
          <button
            type="button"
            onClick={() => setFilterTag(null)}
            className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
              !filterTag
                ? "border-primary bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent"
            }`}
          >
            todas
          </button>
          {allTags.map((tg) => (
            <button
              key={tg}
              type="button"
              onClick={() => setFilterTag(tg === filterTag ? null : tg)}
              className={`rounded-full px-2.5 py-0.5 text-[11px] transition-all ${tagColor(tg)} ${
                filterTag === tg ? "ring-2 ring-primary ring-offset-1" : ""
              }`}
            >
              #{tg}
            </button>
          ))}
        </div>
      )}

      {/* Cards */}
      {termsLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-muted/50" />
          ))}
        </div>
      ) : terms.length === 0 ? (
        <EmptyState onCreate={openNew} />
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">Nenhum tema bate com os filtros.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((t) => {
            const stats = termStats?.get(t.id);
            return (
              <TermCard
                key={t.id}
                term={t}
                d7={stats?.d7 ?? 0}
                d30={stats?.d30 ?? 0}
                lastMatch={stats?.last ?? null}
                sources={
                  t.source_ids
                    .map((id) => sourcesById.get(id))
                    .filter(Boolean) as Array<{
                    code: string;
                    name: string;
                    level: string;
                    uf: string | null;
                  }>
                }
                onToggle={() => toggleActive.mutate(t)}
                onEdit={() => {
                  setTemplate(null);
                  setEditing(t);
                  setOpen(true);
                }}
                onDelete={() => {
                  if (confirm(`Remover "${t.label}"?`)) deleteTerm.mutate(t.id);
                }}
              />
            );
          })}
        </div>
      )}

      <TermDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setEditing(null);
            setTemplate(null);
          }
        }}
        editing={editing}
        template={template}
        sources={sources}
        saving={saveTerm.isPending}
        onSubmit={(values) =>
          saveTerm.mutate(editing ? { ...values, id: editing.id } : values, {
            onSuccess: () => {
              setOpen(false);
              setEditing(null);
            },
          })
        }
      />
    </div>
  );
}
