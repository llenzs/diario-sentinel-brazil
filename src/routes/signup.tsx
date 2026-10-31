import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAuthActions } from "@/hooks/use-auth-actions";
import { AuthSlider } from "@/components/auth/auth-slider";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Criar conta — Diário Oficial Scanner" }] }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { login, register, loading } = useAuthActions();

  useEffect(() => {
    if (!authLoading && user) navigate({ to: "/app" });
  }, [user, authLoading, navigate]);

  const handleLogin = async (email: string, password: string) => {
    await login(email, password);
  };

  return (
    <AuthSlider
      initialMode="register"
      onLogin={handleLogin}
      onRegister={register}
      loading={loading}
    />
  );
}
