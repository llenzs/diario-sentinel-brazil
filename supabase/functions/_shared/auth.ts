import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export async function requireAdmin(req: Request): Promise<{ userId: string }> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    throw new Response("Unauthorized", { status: 401 });
  }
  const token = authHeader.slice(7);
  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supa = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await supa.auth.getUser(token);
  if (userErr || !userData.user) {
    throw new Response("Unauthorized", { status: 401 });
  }
  const userId = userData.user.id;

  const { data: role, error: roleErr } = await supa
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (roleErr || !role) {
    throw new Response("Forbidden: admin only", { status: 403 });
  }
  return { userId };
}
