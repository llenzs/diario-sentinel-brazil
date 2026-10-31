import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ScanText,
  LogOut,
  LayoutDashboard,
  Users,
  Newspaper,
  Bell,
  Search,
  Settings,
  User,
  Plug,
  ShieldCheck,
  Loader2,
  PlayCircle,
  Radar,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { CommandPalette, CommandPaletteTrigger } from "@/components/command-palette";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/app")({
  component: AppShell,
});

type NavItem = {
  to:
    | "/app"
    | "/app/entities"
    | "/app/topics"
    | "/app/sources"
    | "/app/alerts"
    | "/app/search"
    | "/app/pipeline"
    | "/app/notifications"
    | "/app/account"
    | "/app/integrations"
    | "/app/admin"
    | "/app/onboarding";
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
};

// Uso diário — fica no topo da sidebar
const NAV_MAIN: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/alerts", label: "Alertas", icon: Bell },
  { to: "/app/search", label: "Busca histórica", icon: Search },
  { to: "/app/pipeline", label: "Pesquisa manual", icon: PlayCircle, adminOnly: true },
  { to: "/app/entities", label: "Entidades", icon: Users },
  { to: "/app/topics", label: "Temas", icon: Radar },
  { to: "/app/sources", label: "Fontes", icon: Newspaper },
];

// Configurações — fica no footer
const NAV_SETTINGS: NavItem[] = [
  { to: "/app/notifications", label: "Notificações", icon: Settings },
  { to: "/app/account", label: "Conta", icon: User },
  { to: "/app/integrations", label: "Integrações", icon: Plug, adminOnly: true },
  { to: "/app/admin", label: "Operações", icon: ShieldCheck, adminOnly: true },
];

const ALL_NAV = [...NAV_MAIN, ...NAV_SETTINGS];

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, signOut } = useAuth();
  const isAdmin = useIsAdmin();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);


  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }
  if (!user) return null;

  const mainItems = NAV_MAIN.filter((n) => !n.adminOnly || isAdmin);
  const settingsItems = NAV_SETTINGS.filter((n) => !n.adminOnly || isAdmin);

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <Link to="/app" className="flex items-center gap-2 px-2 py-1">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
              <ScanText className="h-4 w-4" />
            </span>
            <span className="truncate font-semibold tracking-tight">Diário Scanner</span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {mainItems.map((item) => (
                  <NavLink key={item.to} item={item} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarSeparator />
          <SidebarGroup className="py-1">
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest">
              Configurações
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {settingsItems.map((item) => (
                  <NavLink key={item.to} item={item} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarSeparator />
          <div className="px-2 py-1 text-xs text-muted-foreground">
            <p className="truncate">{user.email}</p>
            {isAdmin && <p className="mt-0.5 text-[10px] uppercase tracking-wider">Admin</p>}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start"
            onClick={() => signOut().then(() => navigate({ to: "/" }))}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur md:px-6">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <Breadcrumb />
          <div className="ml-auto flex items-center gap-3">
            <PipelineStatusPill />
            <CommandPaletteTrigger />
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
        <CommandPalette />
      </SidebarInset>
    </SidebarProvider>
  );
}

function NavLink({ item }: { item: NavItem }) {
  const location = useLocation();
  const active =
    item.to === "/app" ? location.pathname === "/app" : location.pathname.startsWith(item.to);
  const Icon = item.icon;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
        <Link to={item.to}>
          <Icon className="h-4 w-4" />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function Breadcrumb() {
  const location = useLocation();
  const current = ALL_NAV.find((n) =>
    n.to === "/app" ? location.pathname === "/app" : location.pathname.startsWith(n.to),
  );
  return <p className="text-sm font-medium text-foreground">{current?.label ?? "Painel"}</p>;
}

function PipelineStatusPill() {
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const { data } = useQuery({
    queryKey: ["active-scrape-runs-pill"],
    enabled: !!user?.id,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [pending, running] = await Promise.all([
        supabase
          .from("scrape_runs")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .eq("publication_date", today),
        supabase
          .from("scrape_runs")
          .select("id", { count: "exact", head: true })
          .eq("status", "running")
          .eq("publication_date", today),
      ]);
      return (pending.count ?? 0) + (running.count ?? 0);
    },
    refetchInterval: 3_000,
  });
  if (!data || data === 0) return null;
  const inner = (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/40 bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-300">
      <Loader2 className="h-3 w-3 animate-spin" />
      Pipeline: {data} rodando
    </span>
  );
  return isAdmin ? (
    <Link to="/app/admin/runs" className="hover:opacity-80">
      {inner}
    </Link>
  ) : (
    inner
  );
}
