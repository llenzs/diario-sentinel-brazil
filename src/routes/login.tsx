import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ScanText, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useAuthActions, type MfaChallenge } from "@/hooks/use-auth-actions";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { AuthSlider } from "@/components/auth/auth-slider";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — Diário Oficial Scanner" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { login, register, verifyTotp, loading } = useAuthActions();

  const [mfa, setMfa] = useState<MfaChallenge | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const totpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && user) navigate({ to: "/app" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (mfa) totpRef.current?.focus();
  }, [mfa]);

  const handleLogin = async (email: string, password: string) => {
    const result = await login(email, password);
    if (result.mfa) setMfa(result.mfa);
  };

  const onSubmitTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfa || totpCode.length !== 6) return;
    const ok = await verifyTotp(mfa, totpCode);
    if (!ok) setTotpCode("");
  };

  if (mfa) {
    return (
      <AuthShell
        title="Verificação em duas etapas"
        subtitle="Digite o código do seu aplicativo autenticador"
      >
        <form onSubmit={onSubmitTotp} className="space-y-6">
          <div className="flex flex-col items-center gap-3">
            <ShieldCheck className="h-10 w-10 text-primary" />
            <InputOTP maxLength={6} value={totpCode} onChange={setTotpCode} ref={totpRef}>
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
          <Button type="submit" className="w-full" disabled={loading || totpCode.length !== 6}>
            {loading ? "Verificando..." : "Confirmar"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Código de 6 dígitos do Google Authenticator, Authy ou similar.
          </p>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthSlider
      initialMode="login"
      onLogin={handleLogin}
      onRegister={register}
      loading={loading}
    />
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <ScanText className="h-4 w-4" />
          </span>
          <span className="font-semibold tracking-tight">Diário Oficial Scanner</span>
        </Link>
        <div className="rounded-xl border bg-card p-8 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
