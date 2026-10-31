import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, Copy, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdminWithLoading } from "@/hooks/use-is-admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/app/admin/team")({
  component: TeamPage,
});

function TeamPage() {
  const { user, loading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useIsAdminWithLoading();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");

  const invites = useQuery({
    queryKey: ["admin-invites"],
    enabled: !!user && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_invites");
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("admin_create_invite", {
        _email: email.trim().toLowerCase(),
        _role: role,
      });
      if (error) throw error;
      return data?.[0];
    },
    onSuccess: (data) => {
      if (data) {
        const link = `${window.location.origin}/signup?invite=${data.token}`;
        navigator.clipboard.writeText(link).catch(() => {});
        toast.success("Convite criado — link copiado pra área de transferência");
      }
      setEmail("");
      qc.invalidateQueries({ queryKey: ["admin-invites"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("admin_revoke_invite", { _id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Convite revogado");
      qc.invalidateQueries({ queryKey: ["admin-invites"] });
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
        <h1 className="text-2xl font-semibold tracking-tight">Membros da instância</h1>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Convidar novo membro</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto]">
            <div>
              <Label className="text-xs">E-mail</Label>
              <Input
                type="email"
                placeholder="nome@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Papel</Label>
              <Select value={role} onValueChange={(v) => setRole(v as "user" | "admin")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                className="w-full"
                disabled={!email || create.isPending}
                onClick={() => create.mutate()}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                {create.isPending ? "Criando..." : "Convidar"}
              </Button>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Quando o convidado se cadastrar com o e-mail acima, herdará automaticamente o papel
            escolhido. O link de convite válido por 7 dias é copiado pra clipboard.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Convites</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {invites.isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Carregando...</p>
          ) : !invites.data?.length ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhum convite emitido.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expira</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.data.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-mono text-xs">{i.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {i.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {i.accepted_at ? (
                        <Badge className="bg-emerald-600 text-white text-[10px]">Aceito</Badge>
                      ) : new Date(i.expires_at) < new Date() ? (
                        <Badge variant="secondary" className="text-[10px]">
                          Expirado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          Pendente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(i.expires_at), "dd/MM/yy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      {!i.accepted_at && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => revoke.mutate(i.id)}
                          title="Revogar"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
