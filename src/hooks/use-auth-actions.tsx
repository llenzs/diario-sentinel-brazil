import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const loginSchema = z.object({
  email: z.string().trim().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
});

const signupSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(80),
  email: z.string().trim().email("E-mail inválido"),
  password: z.string().min(8, "Senha deve ter ao menos 8 caracteres").max(72),
});

export type MfaChallenge = { factorId: string; challengeId: string };

export function useAuthActions() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const login = async (
    email: string,
    password: string,
  ): Promise<{ mfa?: MfaChallenge }> => {
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return {};
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword(parsed.data);
      if (error) {
        toast.error(
          error.message === "Invalid login credentials"
            ? "E-mail ou senha incorretos"
            : error.message,
        );
        return {};
      }

      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const factor = factors?.totp?.[0];
        if (factor) {
          const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({
            factorId: factor.id,
          });
          if (chErr || !ch) {
            toast.error("Erro ao iniciar verificação 2FA");
            return {};
          }
          return { mfa: { factorId: factor.id, challengeId: ch.id } };
        }
      }

      toast.success("Bem-vindo de volta");
      navigate({ to: "/app" });
      return {};
    } finally {
      setLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    const parsed = signupSchema.safeParse({ name, email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/app`,
          data: { display_name: parsed.data.name },
        },
      });
      if (error) {
        toast.error(
          error.message.includes("already")
            ? "Já existe uma conta com esse e-mail"
            : error.message,
        );
        return;
      }
      toast.success("Conta criada — verifique seu e-mail para confirmar");
      navigate({ to: "/login" });
    } finally {
      setLoading(false);
    }
  };

  const verifyTotp = async (mfa: MfaChallenge, code: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.mfa.verify({
        factorId: mfa.factorId,
        challengeId: mfa.challengeId,
        code,
      });
      if (error) {
        toast.error("Código incorreto ou expirado");
        return false;
      }
      toast.success("Bem-vindo de volta");
      navigate({ to: "/app" });
      return true;
    } finally {
      setLoading(false);
    }
  };

  return { login, register, verifyTotp, loading };
}
