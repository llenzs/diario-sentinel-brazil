import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ExternalLink, FileSearch, Loader2, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/app/search")({
  validateSearch: (s: Record<string, unknown>) => ({
    q: typeof s.q === "string" ? s.q : "",
    since: typeof s.since === "string" ? s.since : "",
    until: typeof s.until === "string" ? s.until : "",
  }),
  component: SearchPage,
});

const PAGE_SIZE = 20;

function SearchPage() {
  const { q: initQ, since: initSince, until: initUntil } = Route.useSearch();
  const [q, setQ] = useState(initQ);
  const [submitted, setSubmitted] = useState(initQ);
  const [page, setPage] = useState(0);
  const [since, setSince] = useState(initSince);
  const [until, setUntil] = useState(initUntil);

  const results = useQuery({
    queryKey: ["search-pubs", submitted, page, since, until],
    enabled: submitted.trim().length >= 3,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_publications", {
        _q: submitted,
        _source_ids: undefined,
        _since: since || undefined,
        _until: until || undefined,
        _limit: PAGE_SIZE,
        _offset: page * PAGE_SIZE,
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  const total = results.data?.[0]?.total_count ?? 0;
  const totalPages = Math.ceil(Number(total) / PAGE_SIZE);

  const submit = () => {
    setSubmitted(q.trim());
    setPage(0);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Busca histórica</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Buscar em <strong>todas as publicações já coletadas</strong> — independente dos seus
          termos cadastrados. Útil para due diligence e investigação.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="Ex.: João da Silva · 12.345.678/0001-90 · Pregão 045/2026..."
                className="pl-9"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => {
                    setQ("");
                    setSubmitted("");
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button onClick={submit} disabled={q.trim().length < 3}>
              Buscar
            </Button>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Desde
              </Label>
              <Input
                type="date"
                value={since}
                onChange={(e) => setSince(e.target.value)}
                className="h-8 w-[150px] text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Até
              </Label>
              <Input
                type="date"
                value={until}
                onChange={(e) => setUntil(e.target.value)}
                className="h-8 w-[150px] text-xs"
              />
            </div>
            {(since || until) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSince("");
                  setUntil("");
                }}
              >
                Limpar datas
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            💡 Use 3+ caracteres. Buscamos em todo o texto bruto das publicações.
          </p>
        </CardContent>
      </Card>

      {!submitted && (
        <Card className="border-dashed">
          <CardContent className="grid place-items-center gap-2 p-12 text-center">
            <FileSearch className="h-10 w-10 text-muted-foreground/40" />
            <p className="font-medium">Digite algo para começar</p>
            <p className="text-sm text-muted-foreground">
              A busca varre o histórico completo de publicações coletadas. Pode levar alguns
              segundos.
            </p>
          </CardContent>
        </Card>
      )}

      {results.isLoading && (
        <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Buscando...
        </div>
      )}

      {results.isSuccess && submitted && (
        <>
          <p className="text-sm text-muted-foreground">
            {Number(total)} resultado{Number(total) === 1 ? "" : "s"} para{" "}
            <span className="font-mono font-medium text-foreground">"{submitted}"</span>
          </p>
          <div className="space-y-3">
            {results.data?.map((r) => (
              <ResultCard key={r.id} row={r} q={submitted} />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Anterior
              </Button>
              <span className="text-xs text-muted-foreground">
                Página {page + 1} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

type SearchRow = {
  id: string;
  publication_date: string;
  title: string | null;
  url: string | null;
  source_name: string;
  source_uf: string | null;
  excerpt: string;
  similarity: number;
  total_count: number;
};

function ResultCard({ row, q }: { row: SearchRow; q: string }) {
  return (
    <Card className="transition-colors hover:border-primary/40">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm font-medium">
              {row.title || <span className="italic">sem título</span>}
            </CardTitle>
            <CardDescription className="mt-1 text-xs">
              {row.source_name}
              {row.source_uf && ` · ${row.source_uf}`} ·{" "}
              {format(new Date(row.publication_date), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {(row.similarity * 100).toFixed(0)}% relevância
            </Badge>
            {row.url && (
              <Button asChild size="sm" variant="ghost">
                <a href={row.url} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p
          className="text-sm leading-relaxed text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: highlight(row.excerpt, q) }}
        />
      </CardContent>
    </Card>
  );
}

function highlight(text: string, q: string): string {
  if (!q) return escapeHtml(text);
  const safe = escapeHtml(text);
  const qSafe = escapeRegex(escapeHtml(q));
  return safe.replace(
    new RegExp(`(${qSafe})`, "gi"),
    '<mark class="bg-primary/20 text-foreground rounded px-0.5">$1</mark>',
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
