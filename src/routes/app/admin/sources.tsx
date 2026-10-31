import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ChevronLeft, FlaskConical, Pencil, PlayCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdminWithLoading } from "@/hooks/use-is-admin";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/app/admin/sources")({
  component: AdminSourcesPage,
});

type SourceRow = {
  id: string;
  code: string;
  name: string;
  level: "federal" | "state" | "municipal";
  uf: string | null;
  scraper_adapter: string;
  adapter_config: unknown;
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

function AdminSourcesPage() {
  const { user, loading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useIsAdminWithLoading();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<SourceRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [testTarget, setTestTarget] = useState<SourceRow | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const sources = useQuery({
    queryKey: ["admin-sources"],
    enabled: !!user && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sources")
        .select("id, code, name, level, uf, scraper_adapter, adapter_config, enabled")
        .order("level")
        .order("name");
      if (error) throw error;
      return (data ?? []) as SourceRow[];
    },
  });

  const toggleEnabled = useMutation({
    mutationFn: async (s: SourceRow) => {
      const { error } = await supabase
        .from("sources")
        .update({ enabled: !s.enabled })
        .eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-sources"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const runNow = useMutation({
    mutationFn: async (s: SourceRow) => {
      const { error } = await supabase.rpc("admin_run_source", { _source_id: s.id });
      if (error) throw error;
    },
    onSuccess: (_, s) => toast.success(`${s.code}: scrape disparado`),
    onError: (e: Error) => toast.error(e.message),
  });

  const testSource = useMutation({
    mutationFn: async (s: SourceRow) => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase.functions.invoke("test-source", {
        body: { source_id: s.id, date: today },
      });
      if (error) throw error;
      return data as TestResult;
    },
    onSuccess: (result, s) => {
      setTestTarget(s);
      setTestResult(result);
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
        <h1 className="flex-1 text-2xl font-semibold tracking-tight">Fontes (admin)</h1>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Nova fonte
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ativa</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Nível</TableHead>
                <TableHead>Adapter</TableHead>
                <TableHead>Config</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(sources.data ?? []).map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Switch checked={s.enabled} onCheckedChange={() => toggleEnabled.mutate(s)} />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{s.code}</TableCell>
                  <TableCell className="text-sm">{s.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {s.level}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{s.scraper_adapter}</TableCell>
                  <TableCell
                    className="max-w-xs truncate font-mono text-[10px] text-muted-foreground"
                    title={JSON.stringify(s.adapter_config)}
                  >
                    {JSON.stringify(s.adapter_config)}
                  </TableCell>
                  <TableCell className="text-right">
                    {s.scraper_adapter === "firecrawl" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Testar adapter"
                        disabled={testSource.isPending}
                        onClick={() => testSource.mutate(s)}
                      >
                        <FlaskConical className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Rodar scrape agora"
                      disabled={!s.enabled || runNow.isPending}
                      onClick={() => runNow.mutate(s)}
                    >
                      <PlayCircle className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Editar"
                      onClick={() => setEditing(s)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <SourceDialog
        editing={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["admin-sources"] });
          setEditing(null);
        }}
      />

      <CreateSourceDialog
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["admin-sources"] });
          setCreating(false);
        }}
      />

      {testResult && testTarget && (
        <Dialog open onOpenChange={() => { setTestResult(null); setTestTarget(null); }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4" />
                Teste: {testTarget.code}
                <Badge variant={testResult.ok ? "default" : "destructive"} className="ml-1">
                  {testResult.ok ? "OK" : "Falhou"}
                </Badge>
                {testResult.looks_like_content !== undefined && (
                  <Badge variant={testResult.looks_like_content ? "default" : "secondary"}>
                    {testResult.looks_like_content ? "Conteúdo detectado" : "Conteúdo incerto"}
                  </Badge>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              {testResult.mode_used && (
                <div className="flex gap-2 text-muted-foreground">
                  <span className="font-medium">Modo:</span>
                  <code className="font-mono">{testResult.mode_used}</code>
                  {testResult.content_length !== undefined && (
                    <span className="ml-auto">{testResult.content_length.toLocaleString()} chars</span>
                  )}
                </div>
              )}
              {testResult.hint && (
                <p className="rounded border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-200">
                  {testResult.hint}
                </p>
              )}
              {testResult.error && (
                <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                  {testResult.error}
                </p>
              )}
              {testResult.preview && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Prévia do conteúdo</p>
                  <ScrollArea className="h-56 rounded border bg-muted/30 p-3">
                    <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                      {testResult.preview}
                    </pre>
                  </ScrollArea>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => { setTestResult(null); setTestTarget(null); }}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function SourceDialog({
  editing,
  onClose,
  onSaved,
}: {
  editing: SourceRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [adapter, setAdapter] = useState("");
  const [config, setConfig] = useState("");

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setAdapter(editing.scraper_adapter);
      setConfig(JSON.stringify(editing.adapter_config ?? {}, null, 2));
    }
  }, [editing]);

  const save = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      let parsed: Json;
      try {
        parsed = JSON.parse(config);
      } catch {
        throw new Error("adapter_config inválido (JSON)");
      }
      const { error } = await supabase
        .from("sources")
        .update({ name, scraper_adapter: adapter, adapter_config: parsed })
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fonte atualizada");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!editing) return null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar fonte: {editing.code}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Adapter</Label>
            <Input
              value={adapter}
              onChange={(e) => setAdapter(e.target.value)}
              placeholder="inlabs | querido-diario | firecrawl"
            />
          </div>
          <div>
            <Label>adapter_config (JSON)</Label>
            <Textarea
              rows={8}
              value={config}
              onChange={(e) => setConfig(e.target.value)}
              className="font-mono text-xs"
              placeholder='{"url": "https://...", "mode": "scrape"}'
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Para Firecrawl:{" "}
              <code>{`{ "url": "...", "mode": "scrape" | "crawl" | "extract", "limit": 5, "schema": {...} }`}</code>
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateSourceDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [level, setLevel] = useState<"federal" | "state" | "municipal">("municipal");
  const [uf, setUf] = useState("");
  const [city, setCity] = useState("");
  const [adapter, setAdapter] = useState("firecrawl");
  const [config, setConfig] = useState('{\n  "url": ""\n}');

  const create = useMutation({
    mutationFn: async () => {
      let parsed: Json;
      try {
        parsed = JSON.parse(config);
      } catch {
        throw new Error("adapter_config inválido (JSON)");
      }
      const { error } = await supabase.from("sources").insert({
        code: code.trim().toLowerCase(),
        name: name.trim(),
        level,
        uf: uf.trim().toUpperCase() || null,
        city: city.trim() || null,
        scraper_adapter: adapter.trim(),
        adapter_config: parsed,
        enabled: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fonte criada (desabilitada por padrão)");
      setCode("");
      setName("");
      setLevel("municipal");
      setUf("");
      setCity("");
      setAdapter("firecrawl");
      setConfig('{\n  "url": ""\n}');
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!open) return null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova fonte</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Código (slug único)</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="doe-am"
              className="font-mono"
            />
          </div>
          <div>
            <Label>Nível</Label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as typeof level)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="federal">Federal</option>
              <option value="state">Estadual</option>
              <option value="municipal">Municipal</option>
            </select>
          </div>
          <div className="col-span-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Diário Oficial do Estado do Amazonas" />
          </div>
          <div>
            <Label>UF</Label>
            <Input value={uf} onChange={(e) => setUf(e.target.value)} placeholder="AM" maxLength={2} />
          </div>
          <div>
            <Label>Município (se municipal)</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Manaus" />
          </div>
          <div className="col-span-2">
            <Label>Adapter</Label>
            <Input
              value={adapter}
              onChange={(e) => setAdapter(e.target.value)}
              placeholder="inlabs | querido-diario | firecrawl"
            />
          </div>
          <div className="col-span-2">
            <Label>adapter_config (JSON)</Label>
            <Textarea
              rows={5}
              value={config}
              onChange={(e) => setConfig(e.target.value)}
              className="font-mono text-xs"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Firecrawl:{" "}
              <code>{`{ "url": "..." }`}</code> · Querido Diário:{" "}
              <code>{`{ "ibge": "1302603" }`}</code>
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || !code || !name}
          >
            {create.isPending ? "Criando..." : "Criar fonte"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
