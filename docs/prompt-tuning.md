# Tuning do prompt do classificador

O classificador IA fica em `supabase/functions/ai-classifier/index.ts`. O system prompt está no início como `SYSTEM_PROMPT`. Ele é **cacheado** pelo Anthropic (cache_control: ephemeral) — primeira chamada de cada janela paga full; demais pagam ~10%.

## Estrutura do prompt

```
Você é um analista de Diário Oficial brasileiro.
Classifica trechos onde um termo monitorado foi encontrado.

Para cada match, decida:
- category: ...
- summary: ...
- confidence: 0.0–1.0
- is_false_positive: bool
- reason: 1 frase

Categorias: licitacao, nomeacao, exoneracao, processo, multa, homologacao, outro
```

## Como avaliar mudanças

1. Adicione amostras anotadas ao `eval_dataset` (50–100 cobrindo as 7 categorias + casos óbvios de falso positivo).
2. Edite `SYSTEM_PROMPT`, re-deploy.
3. Rode `POST /eval-classifier` (sem body):
   ```bash
   curl -X POST https://<seu>.supabase.co/functions/v1/eval-classifier \
     -H "Authorization: Bearer <anon-key>" \
     -H "apikey: <anon-key>"
   ```
4. Veja métricas em:
   ```sql
   select model, total, precision_pct, fp_rate_pct, created_at
   from public.eval_runs order by created_at desc limit 10;
   ```

## A/B test entre modelos

Mude `integration_configs.anthropic.config.model`:

- `claude-haiku-4-5-20251001` (default, cheap, fast)
- `claude-sonnet-4-6` (mais preciso, 5x mais caro)

Rode `eval-classifier` em ambos e compare `precision_pct` em `eval_runs`.

## Ajustar threshold de notificação

Em `app_settings.ai_confidence_threshold` (default 0.6). Trigger `enqueue_notifications_for_match` só enfileira se `confidence >= threshold`. Aumente pra reduzir ruído; diminua pra ganhar recall.

```sql
update public.app_settings set ai_confidence_threshold = 0.75 where id = 1;
```

## Adicionar nova categoria

Não recomendado quebrar as 7 existentes (são parte do enum `match_category`). Se realmente precisar:

```sql
alter type public.match_category add value 'nova_categoria';
```

Depois atualize o SYSTEM_PROMPT pra incluir a descrição. Re-deploye `ai-classifier`.

## Custos

Haiku 4.5 + cache prompt:

- Input cacheado: $0.30 / 1M tokens
- Input fresh: $0.80 / 1M tokens
- Output: $4 / 1M tokens

Por match: ~400 input + ~100 output ≈ **R$0.001**. 1000 matches/dia = ~R$30/mês.
