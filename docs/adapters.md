# Adapters de scraping

Cada source tem um `scraper_adapter` (string) que identifica a edge function que coleta. Hoje há 3 adapters:

## inlabs

Lê o ZIP diário do DOU em https://inlabs.in.gov.br/. Autentica com email/senha (configurado em `integration_configs.inlabs`). Baixa as 3 seções (DO1, DO2, DO3), parseia o XML e extrai cada `<article>` como publication.

**adapter_config:** `{}` (nenhum)

## querido-diario

Consume a API pública do Querido Diário (https://queridodiario.ok.org.br/api/gazettes). Cobre ~500 municípios brasileiros.

**adapter_config:**

```json
{ "ibge": "3550308" }
```

IBGE codes:

- São Paulo: 3550308
- Rio de Janeiro: 3304557
- BH: 3106200
- Porto Alegre: 4314902
- Curitiba: 4106902
- Recife: 2611606
- Fortaleza: 2304400
- Salvador: 2927408

(Veja https://servicodados.ibge.gov.br/api/v1/localidades/municipios para descobrir outros.)

## firecrawl

Genérico via [Firecrawl](https://firecrawl.dev). 3 modos:

### scrape (default)

Single page → markdown:

```json
{ "url": "https://doe.estado.gov.br/hoje", "mode": "scrape" }
```

### crawl

Multi-page (segue links):

```json
{ "url": "https://doe.estado.gov.br", "mode": "crawl", "limit": 10 }
```

Poll do job até 60s. Cada página vira uma publication.

### extract

Structured extraction com schema JSON:

```json
{
  "url": "https://...",
  "mode": "extract",
  "schema": {
    "type": "object",
    "properties": {
      "title": { "type": "string" },
      "content": { "type": "string" }
    }
  }
}
```

## Como criar um adapter novo

1. Crie `supabase/functions/scrape-<nome>/index.ts` espelhando `scrape-querido-diario/index.ts`.
2. Implemente: receber `{source_id, date}`, marcar `scrape_runs` running, scrape, inserir publications, marcar success/failed.
3. Adicione mapeamento em SQL:
   ```sql
   create or replace function internal.adapter_function_name(adapter text)
   returns text language sql immutable as $$
     select case adapter
       when 'inlabs' then 'scrape-inlabs'
       when 'querido-diario' then 'scrape-querido-diario'
       when 'firecrawl' then 'scrape-firecrawl'
       when '<seu-nome>' then 'scrape-<nome>'
       else null
     end;
   $$;
   ```
4. Atualize source: `update sources set scraper_adapter = '<seu-nome>', adapter_config = '{...}' where code = ...`
5. Deploy via `supabase functions deploy scrape-<nome>` ou Lovable.

O pipeline é **trigger-driven**: inserir `scrape_runs` com status `pending` dispara o adapter via `internal.call_function`. Inserir `publications` dispara `match-extractor`. `ai-classifier` roda no cron.
