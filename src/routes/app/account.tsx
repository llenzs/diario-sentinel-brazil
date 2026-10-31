import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Download, ShieldCheck, ShieldOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export const Route = createFileRoute("/app/account")({
  component: AccountPage,
});

const schema = z.object({
  display_name: z.string().min(1, "Obrigatório").max(120),
});
type FormValues = z.infer<typeof schema>;

function AccountPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const profile = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, locale, created_at")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { display_name: "" },
  });

  useEffect(() => {
    if (profile.data?.display_name) {
      form.reset({ display_name: profile.data.display_name });
    }
  }, [profile.data, form]);

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: values.display_name })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perfil atualizado");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Conta</h1>
        <p className="mt-1 text-sm text-muted-foreground">Dados do seu perfil nesta instância.</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Perfil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="text-sm">
            <p className="text-muted-foreground">E-mail</p>
            <p className="font-mono">{user?.email}</p>
          </div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4">
              <FormField
                control={form.control}
                name="display_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome de exibição</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Privacidade (LGPD)</CardTitle>
          <CardDescription>
            Você é titular dos dados pessoais que armazenamos. Pode exportar tudo ou apagar sua
            conta a qualquer momento.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <ExportButton />
          <DangerButton onConfirmed={() => signOut().then(() => navigate({ to: "/" }))} />
        </CardContent>
      </Card>

      <TotpCard />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Sessão</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => signOut().then(() => navigate({ to: "/" }))}>
            Sair da conta
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function TotpCard() {
  const qc = useQueryClient();
  const [enrollStep, setEnrollStep] = useState<"idle" | "scanning" | "done">("idle");
  const [qrSvg, setQrSvg] = useState("");
  const [secret, setSecret] = useState("");
  const [factorId, setFactorId] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [unenrolling, setUnenrolling] = useState(false);

  const factors = useQuery({
    queryKey: ["mfa-factors"],
    queryFn: async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      return data?.totp ?? [];
    },
  });

  const enrolled = (factors.data ?? []).length > 0;
  const enrolledFactor = factors.data?.[0];

  const startEnroll = async () => {
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    if (error || !data) {
      toast.error(error?.message ?? "Erro ao iniciar 2FA");
      return;
    }
    setFactorId(data.id);
    setQrSvg(data.totp.qr_code);
    setSecret(data.totp.secret);
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: data.id });
    if (chErr || !ch) {
      toast.error("Erro ao criar desafio");
      return;
    }
    setChallengeId(ch.id);
    setEnrollStep("scanning");
  };

  const confirmEnroll = async () => {
    if (verifyCode.length !== 6) return;
    setVerifying(true);
    const { error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code: verifyCode,
    });
    setVerifying(false);
    if (error) {
      toast.error("Código incorreto ou expirado");
      setVerifyCode("");
      return;
    }
    toast.success("2FA ativado com sucesso");
    setEnrollStep("done");
    qc.invalidateQueries({ queryKey: ["mfa-factors"] });
  };

  const unenroll = async () => {
    if (!enrolledFactor) return;
    setUnenrolling(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: enrolledFactor.id });
    setUnenrolling(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("2FA removido");
    qc.invalidateQueries({ queryKey: ["mfa-factors"] });
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="text-base">Autenticação de dois fatores (2FA)</CardTitle>
        <CardDescription>
          {enrolled
            ? "TOTP ativo — você precisará do aplicativo autenticador a cada login."
            : "Adicione uma camada extra de segurança usando um aplicativo como Google Authenticator ou Authy."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {enrolled ? (
          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
              <span>2FA ativo</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={unenroll}
              disabled={unenrolling}
              className="text-destructive hover:text-destructive"
            >
              <ShieldOff className="mr-1.5 h-3.5 w-3.5" />
              {unenrolling ? "Removendo..." : "Remover 2FA"}
            </Button>
          </div>
        ) : enrollStep === "idle" ? (
          <Button variant="outline" onClick={startEnroll}>
            <ShieldCheck className="mr-2 h-4 w-4" /> Ativar 2FA
          </Button>
        ) : enrollStep === "scanning" ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Escaneie o QR code com seu aplicativo autenticador:
            </p>
            <div
              className="inline-block rounded-md border bg-white p-3"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Inserir chave manualmente</summary>
              <code className="mt-1 block break-all font-mono">{secret}</code>
            </details>
            <div className="space-y-2">
              <p className="text-sm">Digite o código de 6 dígitos para confirmar:</p>
              <InputOTP maxLength={6} value={verifyCode} onChange={setVerifyCode}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <div className="flex gap-2">
              <Button onClick={confirmEnroll} disabled={verifying || verifyCode.length !== 6}>
                {verifying ? "Verificando..." : "Confirmar e ativar"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setEnrollStep("idle");
                  setVerifyCode("");
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
            2FA configurado com sucesso!
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ExportButton() {
  const [loading, setLoading] = useState(false);
  const onClick = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("export_my_data");
      if (error) throw error;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `diario-scanner-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Dados exportados");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Button variant="outline" onClick={onClick} disabled={loading}>
      <Download className="mr-2 h-4 w-4" />
      {loading ? "Exportando..." : "Exportar meus dados"}
    </Button>
  );
}

function DangerButton({ onConfirmed }: { onConfirmed: () => void }) {
  const onDelete = async () => {
    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Conta apagada");
    onConfirmed();
  };
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">
          <Trash2 className="mr-2 h-4 w-4" /> Apagar minha conta
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Apagar conta permanentemente?</AlertDialogTitle>
          <AlertDialogDescription>
            Todos os seus termos, alertas, notificações e perfil serão deletados. Esta ação é
            irreversível.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onDelete}>Sim, apagar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
