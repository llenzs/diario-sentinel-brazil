import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  Building2,
  Pencil,
  Plus,
  Power,
  Regex,
  Sparkles,
  StickyNote,
  Tag as TagIcon,
  Trash2,
  Type,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

// Internal marker stored in tags array to separate entity terms from topic terms
export const CATEGORY_TAG = "_entidade";

export const termSchema = z.object({
  label: z.string().min(1, "Obrigatório").max(120),
  pattern: z.string().min(1, "Obrigatório"),
  match_type: z.enum(["literal", "regex", "cnpj"]),
  context_hint: z.string().max(500).optional(),
  notes: z.string().max(5000).optional(),
  active: z.boolean(),
  source_ids: z.array(z.string()).min(1, "Selecione pelo menos uma fonte"),
  tags: z.array(z.string()),
});
export type TermForm = z.infer<typeof termSchema>;

export type TermRow = {
  id: string;
  label: string;
  pattern: string;
  match_type: "literal" | "regex" | "cnpj";
  context_hint: string | null;
  notes: string | null;
  active: boolean;
  source_ids: string[];
  tags: string[];
};

export type TermTemplate = {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  label: string;
  pattern: string;
  match_type: "literal" | "regex" | "cnpj";
  context_hint: string;
};

export type SourceOption = {
  id: string;
  code: string;
  name: string;
  level: "federal" | "state" | "municipal";
  uf: string | null;
};

const TAG_COLORS = [
  "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  "bg-pink-500/15 text-pink-700 dark:text-pink-300",
  "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
];

export function tagColor(tag: string) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_COLORS[h % TAG_COLORS.length];
}

export function useTermRadar(category: "entidade" | "tema") {
  const { user } = useAuth();
  const qc = useQueryClient();

  const sources = useQuery({
    queryKey: ["sources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sources")
        .select("id, code, name, level, uf")
        .eq("enabled", true)
        .order("level")
        .order("name");
      if (error) throw error;
      return data as SourceOption[];
    },
  });

  const terms = useQuery({
    queryKey: ["terms", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("terms")
        .select(
          "id, label, pattern, match_type, context_hint, notes, active, tags, term_sources(source_id)",
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((t) => ({
        id: t.id,
        label: t.label,
        pattern: t.pattern,
        match_type: t.match_type as "literal" | "regex" | "cnpj",
        context_hint: t.context_hint,
        notes: (t as { notes: string | null }).notes ?? null,
        active: t.active,
        source_ids: (t.term_sources ?? []).map((ts: { source_id: string }) => ts.source_id),
        tags: (t.tags as string[] | null) ?? [],
      })) as TermRow[];
    },
  });

  const termStats = useQuery({
    queryKey: ["term-stats", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const since30 = new Date(Date.now() - 30 * 86400_000).toISOString();
      const { data } = await supabase
        .from("matches")
        .select("term_id, created_at")
        .eq("is_false_positive", false)
        .gte("created_at", since30);
      const map = new Map<string, { d7: number; d30: number; last: string | null }>();
      const cut7 = Date.now() - 7 * 86400_000;
      for (const m of data ?? []) {
        const row = m as { term_id: string; created_at: string };
        const t = new Date(row.created_at).getTime();
        const cur = map.get(row.term_id) ?? { d7: 0, d30: 0, last: null };
        cur.d30++;
        if (t >= cut7) cur.d7++;
        if (!cur.last || cur.last < row.created_at) cur.last = row.created_at;
        map.set(row.term_id, cur);
      }
      return map;
    },
    refetchInterval: 60_000,
  });

  const filteredTerms = useMemo(() => {
    if (!terms.data) return [];
    return terms.data.filter((t) =>
      category === "entidade" ? t.tags.includes(CATEGORY_TAG) : !t.tags.includes(CATEGORY_TAG),
    );
  }, [terms.data, category]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const t of filteredTerms) {
      for (const tg of t.tags ?? []) {
        if (tg !== CATEGORY_TAG) set.add(tg);
      }
    }
    return Array.from(set).sort();
  }, [filteredTerms]);

  const sourcesById = useMemo(
    () => new Map((sources.data ?? []).map((s) => [s.id, s])),
    [sources.data],
  );

  const saveTerm = useMutation({
    mutationFn: async (input: TermForm & { id?: string }) => {
      if (!user) throw new Error("not authenticated");
      const baseTags = input.tags.filter((t) => t !== CATEGORY_TAG);
      const finalTags = category === "entidade" ? [CATEGORY_TAG, ...baseTags] : baseTags;
      const payload = {
        user_id: user.id,
        label: input.label,
        pattern: input.pattern,
        match_type: input.match_type,
        context_hint: input.context_hint || null,
        notes: input.notes?.trim() ? input.notes.trim() : null,
        active: input.active,
        tags: finalTags,
      };
      let termId = input.id;
      if (termId) {
        const { error } = await supabase.from("terms").update(payload).eq("id", termId);
        if (error) throw error;
        const { error: delErr } = await supabase
          .from("term_sources")
          .delete()
          .eq("term_id", termId);
        if (delErr) throw delErr;
      } else {
        const { data, error } = await supabase.from("terms").insert(payload).select("id").single();
        if (error) throw error;
        termId = data.id;
      }
      if (input.source_ids.length > 0) {
        const rows = input.source_ids.map((source_id) => ({ term_id: termId!, source_id }));
        const { error } = await supabase.from("term_sources").insert(rows);
        if (error) throw error;
      }
      return termId!;
    },
    onSuccess: (_, variables) => {
      toast.success(variables.id ? "Radar atualizado" : "Radar criado");
      qc.invalidateQueries({ queryKey: ["terms"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async (t: TermRow) => {
      const { error } = await supabase.from("terms").update({ active: !t.active }).eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["terms"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteTerm = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("terms")
        .update({ deleted_at: new Date().toISOString(), active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Radar removido (alertas históricos preservados)");
      qc.invalidateQueries({ queryKey: ["terms"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    sources: sources.data ?? [],
    sourcesById,
    terms: filteredTerms,
    termsLoading: terms.isLoading,
    termStats: termStats.data,
    allTags,
    saveTerm,
    toggleActive,
    deleteTerm,
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

export function TypeIcon({ type }: { type: "literal" | "regex" | "cnpj" }) {
  const Icon = type === "regex" ? Regex : type === "cnpj" ? Building2 : Type;
  return <Icon className="h-4 w-4" />;
}

export function Stat({
  label,
  value,
  highlight,
  small,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
  small?: boolean;
}) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={`mt-0.5 font-semibold tabular-nums ${small ? "text-[11px]" : "text-lg"} ${highlight ? "text-primary" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

export function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Card className="border-dashed">
      <CardContent className="grid place-items-center gap-3 p-12 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-muted">
          <TagIcon className="h-5 w-5 text-muted-foreground" />
        </span>
        <div>
          <p className="font-medium">Nenhum radar cadastrado</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Comece criando um radar ou use um dos templates acima.
          </p>
        </div>
        <Button onClick={onCreate}>
          <Plus className="mr-2 h-4 w-4" /> Criar primeiro radar
        </Button>
      </CardContent>
    </Card>
  );
}

export function TermCard({
  term,
  d7,
  d30,
  lastMatch,
  sources,
  onToggle,
  onEdit,
  onDelete,
}: {
  term: TermRow;
  d7: number;
  d30: number;
  lastMatch: string | null;
  sources: Array<{ code: string; name: string; level: string; uf: string | null }>;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const displayTags = (term.tags ?? []).filter((t) => t !== CATEGORY_TAG);
  return (
    <Card
      className={`group relative overflow-hidden transition-all hover:border-primary/40 hover:shadow-sm ${
        term.active ? "" : "opacity-70"
      }`}
    >
      <div
        className={`absolute inset-y-0 left-0 w-1 ${
          term.active ? "bg-emerald-500" : "bg-muted-foreground/30"
        }`}
      />
      <CardContent className="p-5 pl-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${
                  term.active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                <TypeIcon type={term.match_type} />
              </span>
              <h3 className="truncate text-base font-semibold tracking-tight">{term.label}</h3>
            </div>
            <p className="mt-2 font-mono text-xs text-muted-foreground" title={term.pattern}>
              {term.pattern || <span className="italic">sem padrão definido</span>}
            </p>
            {term.context_hint && (
              <p className="mt-1.5 line-clamp-2 text-[11px] italic text-muted-foreground">
                💡 {term.context_hint}
              </p>
            )}
            {displayTags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {displayTags.map((tg) => (
                  <span
                    key={tg}
                    className={`rounded-full px-2 py-0.5 text-[10px] ${tagColor(tg)}`}
                  >
                    #{tg}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title={term.active ? "Pausar" : "Reativar"}
              onClick={onToggle}
            >
              <Power className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Editar"
              onClick={onEdit}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:text-destructive"
              title="Remover"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 border-t pt-3">
          <Stat label="Matches 7d" value={d7} highlight={d7 > 0} />
          <Stat label="30 dias" value={d30} />
          <Stat
            label="Última"
            value={
              lastMatch
                ? formatDistanceToNow(new Date(lastMatch), { addSuffix: true, locale: ptBR })
                : "—"
            }
            small
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px]">
          <div className="flex flex-wrap items-center gap-1">
            <Badge variant="outline" className="capitalize text-[9px]">
              {term.match_type}
            </Badge>
            {term.active ? (
              <Badge className="bg-emerald-600 text-white text-[9px]">
                <Activity className="mr-0.5 h-2 w-2" /> ativo
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[9px]">
                pausado
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            {sources.length} fonte{sources.length === 1 ? "" : "s"}{" "}
            {sources.length > 0 && (
              <span className="text-foreground/70" title={sources.map((s) => s.name).join(", ")}>
                (
                {sources
                  .slice(0, 3)
                  .map((s) => s.code)
                  .join(", ")}
                {sources.length > 3 && ` +${sources.length - 3}`})
              </span>
            )}
          </p>
        </div>

        {term.notes && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-dashed bg-muted/30 p-2.5">
            <StickyNote className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
            <p className="line-clamp-2 flex-1 text-[11px] text-muted-foreground">{term.notes}</p>
          </div>
        )}

        <div className="mt-3 border-t pt-3">
          <Link
            to="/app/radar/$termId"
            params={{ termId: term.id }}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Ver resultados <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export function TagsInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const displayValue = value.filter((t) => t !== CATEGORY_TAG);
  const add = () => {
    const t = draft.trim().toLowerCase().replace(/^#+/, "").replace(/\s+/g, "-");
    if (t && t !== CATEGORY_TAG && !value.includes(t)) onChange([...value, t]);
    setDraft("");
  };
  const remove = (t: string) => onChange(value.filter((x) => x !== t));

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border bg-background p-2">
      {displayValue.map((t) => (
        <span
          key={t}
          className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${tagColor(t)}`}
        >
          #{t}
          <button
            type="button"
            onClick={() => remove(t)}
            className="text-muted-foreground hover:text-foreground"
            title="Remover"
          >
            ×
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          } else if (e.key === "Backspace" && !draft && displayValue.length > 0) {
            remove(displayValue[displayValue.length - 1]);
          }
        }}
        onBlur={add}
        placeholder={displayValue.length === 0 ? "digite e Enter pra adicionar..." : ""}
        className="min-w-[120px] flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
      />
    </div>
  );
}

export function CpfWarning({
  pattern,
  matchType,
}: {
  pattern: string;
  matchType: string;
}) {
  const isCpf = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test((pattern ?? "").trim());
  if (!isCpf || matchType === "cnpj") return null;
  return (
    <div className="mt-1.5 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-[11px] text-amber-700 dark:text-amber-400">
      ⚠️ Esse padrão parece um <strong>CPF</strong>. CPFs <strong>não</strong> são publicados em
      Diários Oficiais (LGPD). Use o nome da pessoa em vez disso. Se for CNPJ, troque o tipo pra
      "CNPJ".
    </div>
  );
}

export function LongPatternWarning({
  pattern,
  matchType,
}: {
  pattern: string;
  matchType: string;
}) {
  if (matchType !== "literal") return null;
  const wordCount = (pattern ?? "").trim().split(/\s+/).filter(Boolean).length;
  if (wordCount < 5) return null;
  return (
    <div className="mt-1.5 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-[11px] text-amber-700 dark:text-amber-400">
      ⚠️ Padrão literal longo ({wordCount} palavras). A busca é por <strong>substring exata</strong> —
      uma frase inteira raramente aparece verbatim em diário. Prefira a palavra-chave mais curta
      (ex.: <code className="font-mono">licitação</code> já casa "Licitações", "Aviso de Licitação"
      etc.) ou troque o tipo para <strong>Regex</strong>.
    </div>
  );
}

export function TermDialog({
  open,
  onOpenChange,
  editing,
  template,
  sources,
  saving,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: TermRow | null;
  template: TermTemplate | null;
  sources: SourceOption[];
  saving: boolean;
  onSubmit: (values: TermForm) => void;
}) {
  const [suggestions, setSuggestions] = useState<
    Array<{ pattern: string; match_type: "literal" | "regex" | "cnpj"; reason: string }>
  >([]);

  const editingTags = (editing?.tags ?? []).filter((t) => t !== CATEGORY_TAG);

  const form = useForm<TermForm>({
    resolver: zodResolver(termSchema),
    values: editing
      ? {
          label: editing.label,
          pattern: editing.pattern,
          match_type: editing.match_type,
          context_hint: editing.context_hint ?? "",
          notes: editing.notes ?? "",
          active: editing.active,
          source_ids: editing.source_ids,
          tags: editingTags,
        }
      : template
        ? {
            label: template.label,
            pattern: template.pattern,
            match_type: template.match_type,
            context_hint: template.context_hint,
            notes: "",
            active: true,
            source_ids: sources.map((s) => s.id),
            tags: [],
          }
        : {
            label: "",
            pattern: "",
            match_type: "literal",
            context_hint: "",
            notes: "",
            active: true,
            source_ids: sources.map((s) => s.id),
            tags: [],
          },
  });

  const suggest = useMutation({
    mutationFn: async () => {
      const label = form.getValues("label");
      const contextHint = form.getValues("context_hint");
      if (!label) throw new Error("Preencha o rótulo antes de pedir sugestões");
      const { data, error } = await supabase.functions.invoke("ai-suggest-term", {
        body: { label, context_hint: contextHint || undefined },
      });
      if (error) throw error;
      return data as { suggestions: typeof suggestions };
    },
    onSuccess: (data) => {
      setSuggestions(data.suggestions ?? []);
      if (!data.suggestions?.length) toast.info("Sem sugestões dessa vez");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const applySuggestion = (s: (typeof suggestions)[number]) => {
    form.setValue("pattern", s.pattern);
    form.setValue("match_type", s.match_type);
    toast.success(`Padrão aplicado: ${s.pattern}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar radar" : "Novo radar"}</DialogTitle>
          <DialogDescription>
            Defina o padrão a buscar e em quais diários monitorar.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rótulo</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex.: João da Silva (cliente)"
                      {...field}
                      onChange={(e) => {
                        const next = e.target.value;
                        const currentPattern = form.getValues("pattern");
                        const prevLabel = field.value;
                        // Auto-preenche o pattern enquanto ele estiver vazio
                        // ou ainda igual ao label anterior (modo literal só).
                        if (
                          form.getValues("match_type") === "literal" &&
                          (!currentPattern || currentPattern === prevLabel)
                        ) {
                          form.setValue("pattern", next, { shouldValidate: true });
                        }
                        field.onChange(e);
                      }}
                    />
                  </FormControl>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Nome interno usado em listas e alertas. Não é o que vai ser buscado.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="match_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="literal">Literal</SelectItem>
                        <SelectItem value="regex">Regex</SelectItem>
                        <SelectItem value="cnpj">CNPJ</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pattern"
                render={({ field }) => {
                  const matchType = form.watch("match_type");
                  const helper =
                    matchType === "literal"
                      ? "Texto exato buscado (case-insensitive, substring). Use a forma mais curta — \"licitação\" já casa \"Licitações\", \"Aviso de Licitação\" etc."
                      : matchType === "regex"
                        ? "Expressão regular (flags g, i aplicadas)."
                        : "CNPJ (com ou sem máscara). Casa todas as variações de pontuação.";
                  const placeholder =
                    matchType === "literal"
                      ? "Ex.: licitação"
                      : matchType === "regex"
                        ? "Ex.: licita[çc][ãa]o"
                        : "Ex.: 12.345.678/0001-90";
                  return (
                    <FormItem className="sm:col-span-2">
                      <div className="flex items-center justify-between">
                        <FormLabel>Texto a buscar</FormLabel>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px]"
                          onClick={() => suggest.mutate()}
                          disabled={suggest.isPending}
                        >
                          <Sparkles className="mr-1 h-3 w-3" />
                          {suggest.isPending ? "Pensando..." : "Sugerir variações com IA"}
                        </Button>
                      </div>
                      <FormControl>
                        <Input placeholder={placeholder} {...field} />
                      </FormControl>
                      <p className="mt-1 text-[11px] text-muted-foreground">{helper}</p>
                      <CpfWarning pattern={field.value} matchType={matchType} />
                      <LongPatternWarning pattern={field.value} matchType={matchType} />
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </div>

            {suggestions.length > 0 && (
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="mb-2 text-xs font-medium">Sugestões da IA — clique para aplicar:</p>
                <div className="space-y-1.5">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => applySuggestion(s)}
                      className="flex w-full items-start gap-3 rounded-md border bg-card p-2 text-left text-xs hover:bg-accent/40"
                    >
                      <Badge variant="outline" className="shrink-0 text-[9px] capitalize">
                        {s.match_type}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="font-mono">{s.pattern}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">{s.reason}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="context_hint"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contexto (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Ex.: pessoa que mora em São Paulo, advogada, sócia da empresa X"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    A IA usa essa pista para diferenciar homônimos e filtrar falsos positivos.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas do radar (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Anotações privadas sobre este radar: o que monitorar, contatos, lembretes..."
                      rows={3}
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormDescription>
                    Anotações pessoais. Aparecem na página dedicada de resultados do radar.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="source_ids"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fontes monitoradas</FormLabel>
                  <ScrollArea className="h-48 rounded-md border p-3">
                    <div className="space-y-2">
                      {sources.map((s) => {
                        const checked = field.value.includes(s.id);
                        return (
                          <label key={s.id} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(c) => {
                                const next = c
                                  ? [...field.value, s.id]
                                  : field.value.filter((x) => x !== s.id);
                                field.onChange(next);
                              }}
                            />
                            <span className="flex-1">
                              {s.name}
                              {s.uf && (
                                <span className="ml-1 text-muted-foreground">({s.uf})</span>
                              )}
                            </span>
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {s.level}
                            </Badge>
                          </label>
                        );
                      })}
                    </div>
                  </ScrollArea>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags</FormLabel>
                  <FormControl>
                    <TagsInput value={field.value ?? []} onChange={field.onChange} />
                  </FormControl>
                  <FormDescription>
                    Agrupe seus radares por categoria — ex.: #cliente, #concorrente, #pessoal.
                  </FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <FormLabel>Ativo</FormLabel>
                    <FormDescription>
                      Receba alertas em tempo real para este radar.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : editing ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
