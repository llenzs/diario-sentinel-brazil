# Diário Oficial Scanner

> SaaS open-source para monitorar **Diários Oficiais brasileiros** (DOU + DOEs + DOMs) e receber alertas no WhatsApp/e-mail em até 60 minutos. Você faz remix no Lovable, conecta suas API keys e roda na própria conta.

**Demo:** https://diario-scan-pro.lovable.app

---

## Como funciona

```
┌──────────┐    ┌────────────┐    ┌──────────────┐    ┌─────────────┐    ┌─────────┐
│ pg_cron  │───▶│ orchestra- │───▶│  publications │───▶│ ai-classifier│───▶│ notify- │
│  30 min  │    │   tor      │    │  + trigger →  │    │  Haiku 4.5  │    │ dispatch│
└──────────┘    └────────────┘    │ match-extract │    └─────────────┘    │ Evol/Re-│
                                  └──────────────┘                        │ send    │
                                                                          └─────────┘
```

1. **pg_cron** chama `scrape-orchestrator` a cada 30 min.
2. Orchestrator marca `scrape_runs` como pendentes; **DB trigger** dispara o adapter certo (`inlabs` p/ DOU, `querido-diario` p/ DOMs, `firecrawl` p/ DOEs).
3. Adapter insere `publications` → **outro trigger** dispara `match-extractor`, que aplica os termos do usuário (literal/regex/CNPJ).
4. `ai-classifier` roda a cada 2 min, categoriza com **Anthropic Haiku 4.5** + prompt caching, marca falsos positivos.
5. Trigger em `matches` enfileira `notifications` por canal habilitado.
6. `notify-dispatcher` (cron 1 min) envia via **Evolution API** (WhatsApp) ou **Resend** (e-mail) com retry + DLQ.

## Setup (cliente final que faz remix)

### 1. Remix no Lovable

Clique em **Remix on Lovable** na landing. Você terá uma instância sua com banco Supabase próprio.

### 2. Primeiro acesso

- Abra `/signup`, crie a primeira conta — vira **admin** automaticamente.
- Você será redirecionado para `/app/integrations`.

### 3. Configure integrações

| Provider          | Obrigatório?        | Onde pegar                                  |
| ----------------- | ------------------- | ------------------------------------------- |
| **Anthropic**     | ✅                  | https://console.anthropic.com/settings/keys |
| **INLabs**        | recomendado (DOU)   | https://inlabs.in.gov.br/ (cadastro grátis) |
| **Firecrawl**     | opcional (DOEs)     | https://firecrawl.dev                       |
| **Evolution API** | opcional (WhatsApp) | self-hosted ou cloud                        |
| **Resend**        | opcional (e-mail)   | https://resend.com/api-keys                 |

Para cada uma: cole as credenciais, salve, clique **Testar conexão**.

### 4. Configure Runtime (pg_cron)

Na mesma tela, role até **Runtime interno**:

- `Functions URL`: `https://<seu-project>.supabase.co/functions/v1` (pega no painel Supabase do projeto)
- `Service Role Key`: pega em Supabase → Project Settings → API → service_role secret
- Toggle **Cron ativo** → salvar.

### 5. Cadastre termos

Em `/app/terms`, clique **Novo termo**:

- Rótulo: nome amigável (ex.: "João da Silva — cliente principal")
- Padrão: a string/CNPJ/regex a buscar
- Tipo: literal | regex | cnpj
- Contexto: pista p/ IA desambiguar homônimos
- Fontes: marque DOU + os DOMs que interessam

### 6. Configure notificações

Em `/app/notifications`: ligue e-mail e/ou WhatsApp, informe seu telefone (E.164 com `+55`).

A partir daí o cron roda sozinho.

## Stack

- **Frontend/SSR:** TanStack Start + React 19 + Tailwind 4 + shadcn/ui
- **Backend:** Supabase (Postgres + RLS + 9 Edge Functions Deno)
- **IA:** Anthropic Haiku 4.5 com prompt caching
- **Scraping:** INLabs (XML oficial DOU) + Querido Diário API + Firecrawl
- **Notif:** Evolution API + Resend
- **Hosting:** Cloudflare Workers (via @cloudflare/vite-plugin)
- **Package manager:** Bun

## Arquitetura de dados

| Tabela                       | Para quê                                                             |
| ---------------------------- | -------------------------------------------------------------------- |
| `profiles`                   | Dados do usuário (email, telefone, preferências de notif)            |
| `user_roles`                 | Papéis `user`/`admin`                                                |
| `app_settings`               | Singleton com flags operacionais (threshold de confiança, throttle)  |
| `integration_configs`        | API keys dos providers (admin-only via RLS)                          |
| `internal.runtime_config`    | Service role + functions URL pro pg_cron                             |
| `sources`                    | Catálogo de diários (15 seedados)                                    |
| `terms` + `term_sources`     | Termos cadastrados pelo usuário e fontes monitoradas                 |
| `scrape_runs`                | Histórico de execuções por (source, data)                            |
| `publications`               | Texto bruto coletado dos diários (`raw_text` com índice GIN trigram) |
| `matches`                    | Hits dos termos + classificação IA                                   |
| `notifications`              | Fila de entrega WhatsApp/e-mail com retry e DLQ                      |
| `audit_events`               | Logs LGPD de ações sensíveis                                         |
| `invites`                    | Convites de membros (admin-only)                                     |
| `eval_dataset` + `eval_runs` | Golden samples + métricas da IA                                      |

## Como adicionar uma nova fonte

Hoje há 3 adapters: `inlabs`, `querido-diario` e `firecrawl`.

**Querido Diário (fácil):** vá em `/app/admin/sources`, clique no `+` (ou edite uma linha existente), preencha:

```json
{ "ibge": "<código-IBGE-7-dígitos>" }
```

Cobertura: ~500 municípios. Ver lista em https://queridodiario.ok.org.br/

**Firecrawl (qualquer site):**

```json
{ "url": "https://doe.estado.gov.br/hoje", "mode": "scrape" }
```

ou com schema estruturado:

```json
{
  "url": "https://...",
  "mode": "extract",
  "schema": {
    "type": "object",
    "properties": {
      "publications": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "title": { "type": "string" },
            "text": { "type": "string" }
          }
        }
      }
    }
  }
}
```

**Novo adapter customizado:** crie `supabase/functions/scrape-<nome>/index.ts` espelhando `scrape-querido-diario`. Adicione o mapeamento em `internal.adapter_function_name()` no SQL.

## Operações (admin)

- `/app/admin` — overview com KPIs + 3 gráficos
- `/app/admin/runs` — todos os `scrape_runs` com retry manual
- `/app/admin/dlq` — notificações em DLQ com reenvio
- `/app/admin/sources` — toggle e edição de `adapter_config`
- `/app/admin/team` — convidar membros (link `/signup?invite=token`)
- `/health` (edge function) — endpoint de monitoring externo

## LGPD

Em `/app/account`:

- **Exportar meus dados** → JSON completo (profile + termos + matches + notifications + audit).
- **Apagar minha conta** → `auth.users` é deletado, cascade limpa tudo.

`audit_events` registra criação/edição de termos e mudanças de integração.

## Cron jobs

| Job                        | Schedule       | O quê                                                  |
| -------------------------- | -------------- | ------------------------------------------------------ |
| `scrape-orchestrator-30m`  | `*/30 * * * *` | Marca scrape_runs pending → triggers disparam adapters |
| `ai-classifier-2m`         | `*/2 * * * *`  | Classifica matches pendentes em chunks de 5 paralelos  |
| `notify-dispatcher-1m`     | `* * * * *`    | Drena fila de notifications (max 50/run)               |
| `refresh-daily-metrics`    | `*/15 * * * *` | Atualiza view materializada                            |
| `reprocess-stuck-matches`  | `0 3 * * *`    | Reprocessa matches `ai_processed_at NULL > 24h`        |
| `cleanup-old-scrape-runs`  | `0 4 * * 0`    | Apaga scrape_runs > 90 dias                            |
| `cleanup-old-publications` | `0 5 * * 0`    | Apaga publications > 365 dias                          |

## Eval do classificador

Em `/app/admin` (ou via SQL): a edge function `eval-classifier` roda o `eval_dataset` (golden samples) contra o prompt atual e grava resultados em `eval_runs` com precision, recall e by_category.

Pra adicionar amostras:

```sql
insert into public.eval_dataset
  (source_excerpt, source_term_label, source_context_hint,
   expected_category, expected_is_false_positive, notes)
values (..., ..., ..., 'nomeacao', false, '...');
```

## Custos (estimativa)

Tudo na conta do cliente final. Pra ~50 termos × 15 fontes × ~50 matches/dia:

| Serviço                       | Free tier              | Estimativa mensal                            |
| ----------------------------- | ---------------------- | -------------------------------------------- |
| Supabase (Lovable Cloud)      | grátis até 500MB       | R$0–50                                       |
| Anthropic (Haiku 4.5 + cache) | —                      | R$30–80                                      |
| Firecrawl                     | 500 scrapes/mês grátis | R$0 (DOMs via Querido Diário cobrem maioria) |
| Evolution API (self-hosted)   | —                      | R$30 (VPS)                                   |
| Resend                        | 3k e-mails/mês grátis  | R$0                                          |
| **Total**                     |                        | **~R$100/mês**                               |

INLabs (DOU) e Querido Diário (DOMs) são **gratuitos**.

## Roadmap (depois deste fork)

- ☐ URLs reais validadas dos 6 DOEs estaduais (hoje desabilitados por padrão)
- ☐ Wizard onboarding com 5 passos numerados
- ☐ A/B test entre modelos no eval-classifier
- ☐ 2FA TOTP via Supabase MFA
- ☐ Particionamento mensal de `publications`/`matches`
- ☐ Template público na galeria do Lovable

## Licença

MIT.

## Créditos

- [Querido Diário](https://queridodiario.ok.org.br/) (Open Knowledge Brasil) — API pública dos DOMs
- [INLabs](https://inlabs.in.gov.br/) — feed XML do DOU
- [Lovable](https://lovable.dev) — plataforma de desenvolvimento
- [Anthropic](https://anthropic.com) — classificação IA
