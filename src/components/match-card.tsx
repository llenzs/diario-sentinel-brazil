import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  Check,
  ExternalLink,
  FileText,
  Pencil,
  Star,
  StickyNote,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export type MatchRow = {
  id: string;
  publication_id: string | null;
  publication_date: string | null;
  excerpt: string;
  ai_category: string | null;
  ai_summary: string | null;
  ai_confidence: number | null;
  ai_decision_reason: string | null;
  ai_processed_at: string | null;
  is_false_positive: boolean;
  created_at: string;
  read_at: string | null;
  flagged: boolean;
  archived_at: string | null;
  user_note: string | null;
  term_id?: string | null;
  term_label_snapshot?: string | null;
  terms: { label: string } | null;
  publications: {
    publication_date: string;
    title: string | null;
    url: string | null;
    source_id?: string | null;
    sources: { name: string; code: string } | null;
  } | null;
};

/** Humaniza data ISO (YYYY-MM-DD) para "Hoje", "Ontem" ou data por extenso. */
export function humanizeDate(iso: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
  if (iso === today) return "Hoje";
  if (iso === yesterday) return "Ontem";
  try {
    return format(new Date(iso), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  } catch {
    return iso;
  }
}

export function MatchCard({
  match,
  onMark,
  /** Quando true (default), o nome do termo vira link para /app/radar/$termId. */
  linkTerm = true,
  /** Lista de chaves de query a invalidar após mutações. Default: ["matches"]. */
  invalidateKeys = [["matches"]],
}: {
  match: MatchRow;
  onMark: (fp: boolean) => void;
  linkTerm?: boolean;
  invalidateKeys?: ReadonlyArray<readonly unknown[]>;
}) {
  const qc = useQueryClient();
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(match.user_note ?? "");
  const [showFullText, setShowFullText] = useState(false);

  const invalidate = () => {
    for (const key of invalidateKeys) qc.invalidateQueries({ queryKey: key as unknown[] });
  };

  const fullText = useQuery({
    queryKey: ["pub-raw-text", match.publication_id],
    enabled: showFullText && !!match.publication_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("publications")
        .select("raw_text, title, url")
        .eq("id", match.publication_id!)
        .eq("publication_date", match.publication_date!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const term = match.terms?.label ?? match.term_label_snapshot ?? "—";
  const pub = match.publications;
  const source = pub?.sources;
  const pubDate = pub?.publication_date
    ? format(new Date(pub.publication_date), "dd/MM/yyyy", { locale: ptBR })
    : null;
  const detectedAt = match.created_at ? new Date(match.created_at) : null;
  const detectedRelative = detectedAt
    ? formatDistanceToNow(detectedAt, { addSuffix: true, locale: ptBR })
    : null;
  const detectedExact = detectedAt
    ? format(detectedAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    : null;
  const unread = !match.read_at && !match.archived_at && !match.is_false_positive;

  const toggleRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("mark_match_read", {
        _id: match.id,
        _read: !match.read_at,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleFlag = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("mark_match_flagged", {
        _id: match.id,
        _flag: !match.flagged,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleArchive = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("archive_match", {
        _id: match.id,
        _archive: !match.archived_at,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(match.archived_at ? "Desarquivado" : "Arquivado");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveNote = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("set_match_note", {
        _id: match.id,
        _note: noteDraft.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Nota salva");
      setEditingNote(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <Card
        className={`group transition-colors ${
          match.is_false_positive || match.archived_at ? "opacity-60" : ""
        } ${unread ? "border-primary/30 bg-primary/[0.02]" : ""}`}
      >
        <CardContent className="space-y-3 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                {unread && (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-primary" title="Não lido" />
                )}
                {linkTerm && match.term_id ? (
                  <Link
                    to="/app/radar/$termId"
                    params={{ termId: match.term_id }}
                    className="font-medium hover:underline"
                  >
                    {term}
                  </Link>
                ) : (
                  <span className="font-medium">{term}</span>
                )}
                {match.ai_category && (
                  <Badge variant="outline" className="capitalize">
                    {match.ai_category}
                  </Badge>
                )}
                {match.flagged && (
                  <Badge className="bg-amber-500 text-white text-[10px]">
                    <Star className="mr-0.5 h-2.5 w-2.5 fill-current" /> importante
                  </Badge>
                )}
                {match.is_false_positive && <Badge variant="secondary">Falso positivo</Badge>}
                {match.archived_at && <Badge variant="secondary">arquivado</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                {source?.name ?? "Fonte"}
                {pubDate ? ` · Publicado ${pubDate}` : ""}
                {pub?.title ? ` · ${pub.title}` : ""}
              </p>
              {detectedRelative && (
                <p
                  className="text-[10px] uppercase tracking-wider text-muted-foreground"
                  title={detectedExact ?? undefined}
                >
                  Detectado {detectedRelative}
                </p>
              )}
            </div>
            <div className="flex gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title={match.read_at ? "Marcar como não lido" : "Marcar como lido"}
                onClick={() => toggleRead.mutate()}
              >
                <Check className={`h-3.5 w-3.5 ${match.read_at ? "text-primary" : ""}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title={match.flagged ? "Desmarcar importante" : "Marcar como importante"}
                onClick={() => toggleFlag.mutate()}
              >
                <Star
                  className={`h-3.5 w-3.5 ${match.flagged ? "fill-amber-500 text-amber-500" : ""}`}
                />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Adicionar nota"
                onClick={() => setEditingNote((v) => !v)}
              >
                <StickyNote className={`h-3.5 w-3.5 ${match.user_note ? "text-primary" : ""}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title={match.archived_at ? "Desarquivar" : "Arquivar"}
                onClick={() => toggleArchive.mutate()}
              >
                <Archive className="h-3.5 w-3.5" />
              </Button>
              {match.publication_id && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Ver texto completo da publicação"
                  onClick={() => setShowFullText(true)}
                >
                  <FileText className="h-3.5 w-3.5" />
                </Button>
              )}
              {pub?.url && (
                <Button asChild variant="ghost" size="icon" className="h-8 w-8" title="Abrir fonte">
                  <a href={pub.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onMark(!match.is_false_positive)}
                title={match.is_false_positive ? "Reconfirmar" : "Marcar como falso positivo"}
              >
                {match.is_false_positive ? (
                  <ThumbsUp className="h-3.5 w-3.5" />
                ) : (
                  <ThumbsDown className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>

          {match.ai_summary && (
            <p className="rounded-md bg-muted/40 p-3 text-sm">{match.ai_summary}</p>
          )}
          <p className="line-clamp-3 text-xs text-muted-foreground">{match.excerpt}</p>
          {match.ai_decision_reason && (
            <p className="text-[10px] italic text-muted-foreground">
              IA: {match.ai_decision_reason}
            </p>
          )}

          {editingNote ? (
            <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
              <Textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Sua nota sobre este alerta (privada)..."
                rows={2}
                className="text-xs"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setNoteDraft(match.user_note ?? "");
                    setEditingNote(false);
                  }}
                >
                  Cancelar
                </Button>
                <Button size="sm" onClick={() => saveNote.mutate()} disabled={saveNote.isPending}>
                  {saveNote.isPending ? "Salvando..." : "Salvar nota"}
                </Button>
              </div>
            </div>
          ) : match.user_note ? (
            <div className="flex items-start gap-2 rounded-md border bg-card/50 p-2.5">
              <StickyNote className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
              <p className="flex-1 whitespace-pre-wrap text-xs">{match.user_note}</p>
              <button
                type="button"
                onClick={() => setEditingNote(true)}
                className="text-muted-foreground hover:text-foreground"
                title="Editar nota"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          ) : null}
          {typeof match.ai_confidence === "number" && (
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Confiança: {(match.ai_confidence * 100).toFixed(0)}%
            </p>
          )}
        </CardContent>
      </Card>

      <Sheet open={showFullText} onOpenChange={setShowFullText}>
        <SheetContent side="right" className="flex w-full max-w-2xl flex-col sm:max-w-2xl">
          <SheetHeader className="shrink-0">
            <SheetTitle className="pr-8 leading-snug">
              {fullText.data?.title ?? pub?.title ?? `${source?.name} · ${pub?.publication_date}`}
            </SheetTitle>
            <SheetDescription className="flex flex-wrap items-center gap-2">
              <span>{source?.name}</span>
              {pub?.publication_date && <span>· {pub.publication_date}</span>}
              {fullText.data?.url && (
                <a
                  href={fullText.data.url}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto flex items-center gap-1 text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> Abrir original
                </a>
              )}
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="-mx-6 mt-4 flex-1 px-6">
            {fullText.isLoading && (
              <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>
            )}
            {fullText.isError && (
              <p className="py-8 text-center text-sm text-destructive">
                Erro ao carregar texto da publicação.
              </p>
            )}
            {fullText.data && (
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                {fullText.data.raw_text}
              </pre>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
