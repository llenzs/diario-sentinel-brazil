import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, MessageCircle, CheckCircle2, Clock, XCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/app/notifications")({
  component: NotificationsPage,
});

const schema = z.object({
  notify_email: z.boolean(),
  notify_whatsapp: z.boolean(),
  phone_e164: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^\+\d{10,15}$/.test(v), {
      message: "Use formato E.164: +5511999998888",
    }),
});
type FormValues = z.infer<typeof schema>;

type NotifRow = {
  id: string;
  channel: "email" | "whatsapp";
  status: "queued" | "sent" | "dlq";
  attempts: number;
  sent_at: string | null;
  error: string | null;
  created_at: string;
  matches: {
    ai_summary: string | null;
    ai_category: string | null;
    terms: { label: string };
    publications: {
      publication_date: string;
      url: string | null;
      sources: { name: string };
    };
  };
};

function NotificationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const history = useQuery({
    queryKey: ["notif-history", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select(
          "id, channel, status, attempts, sent_at, error, created_at, matches!inner(ai_summary, ai_category, terms!inner(label), publications!inner(publication_date, url, sources!inner(name)))",
        )
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as NotifRow[];
    },
  });

  const profile = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("notify_email, notify_whatsapp, phone_e164")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { notify_email: true, notify_whatsapp: false, phone_e164: "" },
  });

  useEffect(() => {
    if (profile.data) {
      form.reset({
        notify_email: profile.data.notify_email,
        notify_whatsapp: profile.data.notify_whatsapp,
        phone_e164: profile.data.phone_e164 ?? "",
      });
    }
  }, [profile.data, form]);

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      if (values.notify_whatsapp && !values.phone_e164) {
        throw new Error("Informe um telefone para receber WhatsApp.");
      }
      const { error } = await supabase
        .from("profiles")
        .update({
          notify_email: values.notify_email,
          notify_whatsapp: values.notify_whatsapp,
          phone_e164: values.phone_e164 || null,
        })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Preferências salvas");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notificações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha como quer receber os alertas. WhatsApp requer Evolution API configurada.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Canais de entrega</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-5">
              <FormField
                control={form.control}
                name="notify_email"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-md border p-4">
                    <div>
                      <FormLabel>E-mail</FormLabel>
                      <FormDescription>
                        Recebe o resumo + link da publicação em {user?.email}.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notify_whatsapp"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-md border p-4">
                    <div>
                      <FormLabel>WhatsApp</FormLabel>
                      <FormDescription>Alertas instantâneos via Evolution API.</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone_e164"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone (E.164)</FormLabel>
                    <FormControl>
                      <Input placeholder="+5511999998888" {...field} />
                    </FormControl>
                    <FormDescription>
                      Obrigatório se WhatsApp estiver ativo. Inclua código do país.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Salvando..." : "Salvar preferências"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Histórico recente</CardTitle>
        </CardHeader>
        <CardContent>
          {history.isLoading && (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          )}
          {!history.isLoading && (history.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhuma notificação enviada ainda. Configure um canal acima e aguarde o próximo match.
            </p>
          )}
          <div className="space-y-2">
            {(history.data ?? []).map((n) => (
              <NotifHistoryRow key={n.id} n={n} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function NotifHistoryRow({ n }: { n: NotifRow }) {
  const pub = n.matches.publications;
  const statusIcon =
    n.status === "sent" ? (
      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
    ) : n.status === "dlq" ? (
      <XCircle className="h-3.5 w-3.5 text-destructive" />
    ) : (
      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
    );

  const channelIcon =
    n.channel === "email" ? (
      <Mail className="h-3.5 w-3.5" />
    ) : (
      <MessageCircle className="h-3.5 w-3.5" />
    );

  return (
    <div className="flex items-start gap-3 rounded-md border p-3 text-sm">
      <div className="mt-0.5 flex shrink-0 items-center gap-1.5 text-muted-foreground">
        {statusIcon}
        {channelIcon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-medium">{n.matches.terms.label}</span>
          <span className="text-xs text-muted-foreground">
            {pub.sources.name} · {pub.publication_date}
          </span>
          {n.matches.ai_category && (
            <Badge variant="secondary" className="text-[10px]">
              {n.matches.ai_category}
            </Badge>
          )}
        </div>
        {n.matches.ai_summary && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.matches.ai_summary}</p>
        )}
        {n.status === "dlq" && n.error && (
          <p className="mt-1 text-xs text-destructive">{n.error}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {pub.url && (
          <a
            href={pub.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        <span className="text-[10px] text-muted-foreground">
          {n.sent_at
            ? new Date(n.sent_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
            : new Date(n.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
        </span>
      </div>
    </div>
  );
}
