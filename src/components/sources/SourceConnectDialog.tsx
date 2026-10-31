import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Power,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SourceLite = {
  id: string;
  code: string;
  name: string;
  level: "federal" | "state" | "municipal";
  uf: string | null;
  scraper_adapter: string;
  adapter_config: Record<string, unknown>;
  enabled: boolean;
};

type TestResult = {
  ok: boolean;
  content_length?: number;
  preview?: string;
  looks_like_content?: boolean;
  hint?: string;
  mode_used?: string;
  error?: string;
};

const TIPS_BY_STATE: Record<string, string[]> = {
  SP: ["No DOE-SP, clique em 'Pesquisa de Publicações' e depois 'Última edição publicada' — copie aquele URL"],
  RJ: ["O IOERJ tem 'Diário Oficial' no menu superior — abrir a edição mais recente"],
  MG: ["O Jornal Minas Gerais expõe a edição do dia direto na home — pode tentar com a home mesmo"],
  RS: ["O diário oficial RS abre a edição em PDF. Use o link 'Última edição' ou 'Edição completa'"],
  // Padrão genérico será usado pra outros estados
};

export function SourceConnectDialog({
  source,
  onOpenChange,
  onConnected,
}: {
  source: SourceLite | null;
  onOpenChange: (open: boolean) => void;
  onConnected?: () => void;
}) {
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<"scrape" | "crawl" | "extract">("scrape");
  const [result, setResult] = useState<TestResult | null>(null);

  useEffect(() => {
    if (source) {
      const cfg = source.adapter_config as { url?: string; mode?: string };
      setUrl(cfg.url ?? "");
      setMode((cfg.mode as "scrape" | "crawl" | "extract") ?? "scrape");
      setResult(null);
    }
  }, [source]);

  const test = useMutation({
    mutationFn: async (): Promise<TestResult> => {
      if (!source) throw new Error("no source");
      const { data, error } = await supabase.functions.invoke("test-source", {
        body: { source_id: source.id, override_url: url, override_mode: mode },
      });
      if (error) throw error;
      return data as TestResult;
    },
    onSuccess: (data) => setResult(data),
    onError: (e: Error) => {
      setResult({ ok: false, error: e.message });
    },
  });

  const saveAndActivate = useMutation({
    mutationFn: async () => {
      if (!source) throw new Error("no source");
      // Atualiza adapter_config + ativa
      const { error } = await supabase
        .from("sources")
        .update({
          enabled: true,
          adapter_config: { ...source.adapter_config, url, mode },
        })
        .eq("id", source.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fonte ativada");
      qc.invalidateQueries({ queryKey: ["admin-sources"] });
      qc.invalidateQueries({ queryKey: ["sources-all"] });
      onConnected?.();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveOnly = useMutation({
    mutationFn: async () => {
      if (!source) throw new Error("no source");
      const { error } = await supabase
        .from("sources")
        .update({ adapter_config: { ...source.adapter_config, url, mode } })
        .eq("id", source.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configuração salva (fonte permanece desativada)");
      qc.invalidateQueries({ queryKey: ["admin-sources"] });
      qc.invalidateQueries({ queryKey: ["sources-all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!source) return null;
  const tips = source.uf ? TIPS_BY_STATE[source.uf] : null;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {source.name}
            {source.uf && <Badge variant="outline">{source.uf}</Badge>}
            <Badge variant="outline" className="font-mono text-[10px]">{source.code}</Badge>
          </DialogTitle>
          <DialogDescription>
            {source.enabled
              ? "Ajuste a URL ou modo de coleta. Use 'Testar' para validar antes de salvar."
              : "Configure e teste a URL da edição do dia para ativar esta fonte."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Passos */}
          <ol className="space-y-2 rounded-md border bg-muted/30 p-3 text-xs">
            <li className="flex items-start gap-2">
              <Step n={1} />
              <span>
                Abra o portal do diário oficial:{" "}
                {url && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-primary hover:underline"
                  >
                    {url} <ExternalLink className="inline h-3 w-3" />
                  </a>
                )}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Step n={2} />
              <span>
                Navegue até a <strong>edição mais recente</strong> ou a página que lista o conteúdo
                publicado. Não use a home se ela for só menu.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Step n={3} />
              <span>
                Copie esse URL específico e cole abaixo. Use modo <strong>scrape</strong> pra
                página única ou <strong>crawl</strong> pra coletar várias.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Step n={4} />
              <span>
                Clique em <strong>Testar conexão</strong>. Se aparecer conteúdo de portaria/decreto,
                pode ativar.
              </span>
            </li>
            {tips?.map((t, i) => (
              <li key={i} className="ml-7 flex items-start gap-2 text-[11px] italic text-muted-foreground">
                💡 {t}
              </li>
            ))}
          </ol>

          {/* URL + Mode */}
          <div>
            <Label className="text-xs">URL da edição</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="font-mono text-xs"
            />
          </div>
          <div>
            <Label className="text-xs">Modo de coleta</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as "scrape" | "crawl" | "extract")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scrape">Scrape — uma página só (mais rápido)</SelectItem>
                <SelectItem value="crawl">Crawl — segue links até 5 páginas</SelectItem>
                <SelectItem value="extract">Extract — extração estruturada (avançado)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Resultado do teste */}
          {result && (
            <div
              className={`rounded-md border p-3 text-sm ${
                result.ok && result.looks_like_content
                  ? "border-emerald-500/40 bg-emerald-500/5"
                  : result.ok
                    ? "border-amber-500/40 bg-amber-500/5"
                    : "border-destructive/40 bg-destructive/5"
              }`}
            >
              <div className="flex items-start gap-2">
                {result.ok && result.looks_like_content ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : result.ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {result.ok && result.looks_like_content
                      ? "Tudo certo — parece ser uma edição válida"
                      : result.ok
                        ? "Carregou, mas pode não ser o conteúdo certo"
                        : "Falha ao testar"}
                  </p>
                  {result.hint && (
                    <p className="mt-1 text-xs text-muted-foreground">{result.hint}</p>
                  )}
                  {result.error && (
                    <p className="mt-1 break-all font-mono text-[10px] text-destructive">
                      {result.error}
                    </p>
                  )}
                  {result.preview && (
                    <div className="mt-2 max-h-40 overflow-auto rounded border bg-background p-2">
                      <p className="font-mono text-[10px] whitespace-pre-wrap">{result.preview}</p>
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        {result.content_length} caracteres totais
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="ghost" size="sm" disabled={!url}>
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1 h-3 w-3" /> Abrir site
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => test.mutate()}
              disabled={test.isPending || !url}
            >
              {test.isPending ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" /> Testando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-3 w-3" /> Testar conexão
                </>
              )}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => saveOnly.mutate()}
              disabled={saveOnly.isPending}
            >
              Salvar config
            </Button>
            <Button
              onClick={() => saveAndActivate.mutate()}
              disabled={saveAndActivate.isPending || !result?.ok}
              size="sm"
            >
              <Power className="mr-2 h-3 w-3" />
              {source.enabled ? "Salvar (já ativo)" : "Ativar fonte"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
      {n}
    </span>
  );
}
