import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Bell,
  Brain,
  Command,
  LayoutDashboard,
  Newspaper,
  Plug,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Tag,
  User,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/use-is-admin";

const KBD_OPEN_KEY = "k";

const openContext: { open?: () => void } = {};

export function CommandPaletteTrigger() {
  return (
    <Button
      variant="outline"
      size="sm"
      className="hidden gap-2 text-muted-foreground md:flex"
      onClick={() => openContext.open?.()}
    >
      <Search className="h-3.5 w-3.5" />
      <span className="text-xs">Buscar...</span>
      <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">⌘K</kbd>
    </Button>
  );
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();

  useEffect(() => {
    openContext.open = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === KBD_OPEN_KEY && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      openContext.open = undefined;
    };
  }, []);

  const terms = useQuery({
    queryKey: ["cmd-terms"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("terms")
        .select("id, label, active")
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const recent = useQuery({
    queryKey: ["cmd-recent"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("matches")
        .select("id, ai_category, terms(label), publications(sources(name), publication_date)")
        .eq("is_false_positive", false)
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const go = (to: Parameters<typeof navigate>[0]["to"]) => {
    setOpen(false);
    navigate({ to });
  };

  const runPipeline = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_trigger_pipeline");
      if (error) throw error;
    },
    onSuccess: () => toast.success("Pipeline disparado"),
    onError: (e: Error) => toast.error(e.message),
  });

  const runClassifier = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_trigger_classifier");
      if (error) throw error;
    },
    onSuccess: () => toast.success("Classificador disparado"),
    onError: (e: Error) => toast.error(e.message),
  });

  const runDispatcher = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_trigger_dispatcher");
      if (error) throw error;
    },
    onSuccess: () => toast.success("Dispatcher disparado"),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Digite um comando ou busque termos, alertas..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado.</CommandEmpty>

        <CommandGroup heading="Navegação">
          <CommandItem onSelect={() => go("/app")}>
            <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
          </CommandItem>
          <CommandItem onSelect={() => go("/app/alerts")}>
            <Bell className="mr-2 h-4 w-4" /> Alertas
          </CommandItem>
          <CommandItem onSelect={() => go("/app/terms")}>
            <Tag className="mr-2 h-4 w-4" /> Termos
          </CommandItem>
          <CommandItem onSelect={() => go("/app/sources")}>
            <Newspaper className="mr-2 h-4 w-4" /> Fontes
          </CommandItem>
          <CommandItem onSelect={() => go("/app/notifications")}>
            <Settings className="mr-2 h-4 w-4" /> Notificações
          </CommandItem>
          <CommandItem onSelect={() => go("/app/account")}>
            <User className="mr-2 h-4 w-4" /> Conta
          </CommandItem>
          {isAdmin && (
            <>
              <CommandItem onSelect={() => go("/app/integrations")}>
                <Plug className="mr-2 h-4 w-4" /> Integrações
              </CommandItem>
              <CommandItem onSelect={() => go("/app/admin")}>
                <ShieldCheck className="mr-2 h-4 w-4" /> Operações
              </CommandItem>
            </>
          )}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Ações rápidas">
          <CommandItem onSelect={() => go("/app/terms")}>
            <Plus className="mr-2 h-4 w-4" /> Criar termo
          </CommandItem>
          {isAdmin && (
            <>
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  runPipeline.mutate();
                }}
              >
                <Zap className="mr-2 h-4 w-4" /> Rodar pipeline completo
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  runClassifier.mutate();
                }}
              >
                <Brain className="mr-2 h-4 w-4" /> Classificar matches pendentes
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  runDispatcher.mutate();
                }}
              >
                <Send className="mr-2 h-4 w-4" /> Enviar notificações da fila
              </CommandItem>
            </>
          )}
        </CommandGroup>

        {(terms.data?.length ?? 0) > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Seus termos">
              {terms.data!.map((t) => (
                <CommandItem key={t.id} value={t.label} onSelect={() => go("/app/terms")}>
                  <Tag className="mr-2 h-4 w-4" />
                  {t.label}
                  {!t.active && <CommandShortcut className="text-[10px]">pausado</CommandShortcut>}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {(recent.data?.length ?? 0) > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Alertas recentes">
              {recent.data!.map((m) => {
                const row = m as unknown as {
                  id: string;
                  ai_category: string | null;
                  terms: { label: string } | null;
                  publications: {
                    sources: { name: string } | null;
                    publication_date: string;
                  } | null;
                };
                return (
                  <CommandItem
                    key={row.id}
                    value={`${row.terms?.label ?? ""} ${row.publications?.sources?.name ?? ""}`}
                    onSelect={() => go("/app/alerts")}
                  >
                    <Bell className="mr-2 h-4 w-4" />
                    <span className="truncate">
                      {row.terms?.label ?? "—"}
                      {row.ai_category && (
                        <span className="ml-2 text-[10px] text-muted-foreground capitalize">
                          {row.ai_category}
                        </span>
                      )}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />

        <CommandGroup heading="Atalhos">
          <CommandItem disabled>
            <Command className="mr-2 h-4 w-4" />
            Abrir esse menu
            <CommandShortcut>⌘ K</CommandShortcut>
          </CommandItem>
          <CommandItem disabled>
            <Search className="mr-2 h-4 w-4" />
            Buscar no histórico
            <CommandShortcut>⌘ /</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
