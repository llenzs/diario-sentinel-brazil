# Troubleshooting

## Pipeline parado (nada acontece)

**Checagem:**

```sql
select * from internal.runtime_config;
```

Se `service_role_key` ou `functions_url` for null, ou `cron_enabled = false`, o pipeline não roda.

**Fix:** vá em `/app/integrations`, role até **Runtime interno**, preencha e marque cron ativo.

## Scrape runs sempre pending

O trigger tentou chamar mas falhou. Veja:

```sql
select * from net._http_response order by created desc limit 10;
```

Status 401 → service_role inválida (recoloque). Status 500/timeout → veja `scrape_runs.error`.

## Matches inseridos mas `ai_processed_at` sempre null

```sql
select count(*) from public.matches where ai_processed_at is null;
```

Se cresce sempre: o cron `ai-classifier-2m` está parado, ou Anthropic está disabled.

```sql
select * from integration_configs where provider = 'anthropic';
```

`enabled` deve ser true e `last_test_ok` true. Se não, vá em `/app/integrations` → "Testar conexão".

## Notifications em DLQ

`/app/admin/dlq` mostra erros. Geralmente:

- WhatsApp DLQ → Evolution API offline ou número desconectado
- E-mail DLQ → domínio do Resend não verificado ou e-mail inválido

Use o botão de retry para reenviar após corrigir.

## Lentidão em match-extractor

Verifique se o índice GIN trigram está OK:

```sql
select indexname from pg_indexes where tablename = 'publications';
```

Deve ter `idx_publications_raw_text_trgm`. Se não:

```sql
create extension if not exists pg_trgm;
create index idx_publications_raw_text_trgm
  on public.publications using gin (raw_text gin_trgm_ops);
```

## Cron jobs

Listar:

```sql
select jobname, schedule, active from cron.job;
```

Logs:

```sql
select * from cron.job_run_details order by start_time desc limit 20;
```

Reiniciar um job:

```sql
select cron.unschedule('<jobname>');
select cron.schedule('<jobname>', '<schedule>', $$<sql>$$);
```

## "verify_jwt": false nas edge functions

Comportamento esperado no Lovable Cloud (não dá pra mudar). A auth real está no código (cada função valida o header `Authorization` manualmente quando necessário). O gateway ainda exige _algum_ header de auth — chamadas anônimas sem header retornam 401 antes de chegar na função.

## Re-rodar uma scrape específica

`/app/admin/runs` → botão de retry, ou via SQL:

```sql
update public.scrape_runs
  set status = 'pending', error = null
  where source_id = '...' and publication_date = '...';
```

O trigger re-dispara o adapter automaticamente.
