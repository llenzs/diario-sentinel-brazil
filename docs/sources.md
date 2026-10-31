# Fontes monitoradas

Total: **48 fontes** (1 federal + 27 estaduais + 20 municipais).

## Federal (1)

| Code  | Nome                    | Adapter  | Status     |
| ----- | ----------------------- | -------- | ---------- |
| `dou` | Diário Oficial da União | `inlabs` | ✅ enabled |

INLabs serve XML diário oficial via cadastro grátis em https://inlabs.in.gov.br/

## Estaduais (27 — todos UF + DF)

Todos via adapter **`firecrawl`** (DOEs estaduais não têm API uniforme). **Disabled por padrão** — admin valida URL antes de ativar.

| UF  | Code     | URL                                                             |
| --- | -------- | --------------------------------------------------------------- |
| AC  | `doe-ac` | https://diario.ac.gov.br/                                       |
| AL  | `doe-al` | https://imprensaoficial.al.gov.br/                              |
| AP  | `doe-ap` | https://www.diofe.ap.gov.br/                                    |
| AM  | `doe-am` | http://diario.imprensaoficial.am.gov.br/                        |
| BA  | `doe-ba` | https://dool.egba.ba.gov.br/                                    |
| CE  | `doe-ce` | http://pesquisa.doe.seplag.ce.gov.br/                           |
| DF  | `doe-df` | https://www.dodf.df.gov.br/                                     |
| ES  | `doe-es` | https://ioes.dio.es.gov.br/                                     |
| GO  | `doe-go` | https://diariooficial.go.gov.br/                                |
| MA  | `doe-ma` | https://diariooficial.ma.gov.br/                                |
| MG  | `doe-mg` | https://www.jornalminasgerais.mg.gov.br/                        |
| MS  | `doe-ms` | https://www.spdo.ms.gov.br/diariodoe/                           |
| MT  | `doe-mt` | https://www.iomat.mt.gov.br/portal/edicoes/                     |
| PA  | `doe-pa` | https://www.ioepa.com.br/                                       |
| PB  | `doe-pb` | https://diariooficial.pb.gov.br/                                |
| PE  | `doe-pe` | https://www.cepe.com.br/diariooficial                           |
| PI  | `doe-pi` | https://www.diario.pi.gov.br/                                   |
| PR  | `doe-pr` | https://www.imprensaoficial.pr.gov.br/Diarios/                  |
| RJ  | `doe-rj` | https://www.ioerj.com.br/portal/modules/content/index.php?id=21 |
| RN  | `doe-rn` | http://diariooficial.rn.gov.br/                                 |
| RO  | `doe-ro` | http://www.diof.ro.gov.br/                                      |
| RR  | `doe-rr` | https://www.imprensaoficial.rr.gov.br/                          |
| RS  | `doe-rs` | https://www.diariooficial.rs.gov.br/                            |
| SC  | `doe-sc` | https://doe.sea.sc.gov.br/                                      |
| SE  | `doe-se` | https://www.segrase.se.gov.br/                                  |
| SP  | `doe-sp` | https://www.doe.sp.gov.br/                                      |
| TO  | `doe-to` | https://diariooficial.to.gov.br/                                |

### Como ativar um DOE

Admin vai em [/app/admin/sources](../src/routes/app/admin/sources.tsx), edita a fonte, ajusta `adapter_config` (modos disponíveis: `scrape` / `crawl` / `extract` — ver [adapters.md](adapters.md)) e liga o switch. Cada portal estadual tem layout diferente, então pode precisar trocar URL pra página correta da edição do dia (não a home).

## Municipais (20 maiores cidades por população)

Todas via adapter **`querido-diario`** ([Open Knowledge Brasil](https://queridodiario.ok.org.br/)). API pública, grátis, base URL `https://api.queridodiario.ok.org.br/gazettes`.

| Rank | Code      | Cidade                | UF  | IBGE    |
| ---- | --------- | --------------------- | --- | ------- |
| 1    | `dom-spo` | São Paulo             | SP  | 3550308 |
| 2    | `dom-rio` | Rio de Janeiro        | RJ  | 3304557 |
| 3    | `dom-bsb` | Brasília (use DOE-DF) | DF  | 5300108 |
| 4    | `dom-for` | Fortaleza             | CE  | 2304400 |
| 5    | `dom-ssa` | Salvador              | BA  | 2927408 |
| 6    | `dom-bhz` | Belo Horizonte        | MG  | 3106200 |
| 7    | `dom-mao` | Manaus                | AM  | 1302603 |
| 8    | `dom-cwb` | Curitiba              | PR  | 4106902 |
| 9    | `dom-rec` | Recife                | PE  | 2611606 |
| 10   | `dom-goi` | Goiânia               | GO  | 5208707 |
| 11   | `dom-bel` | Belém                 | PA  | 1501402 |
| 12   | `dom-poa` | Porto Alegre          | RS  | 4314902 |
| 13   | `dom-guh` | Guarulhos             | SP  | 3518800 |
| 14   | `dom-cps` | Campinas              | SP  | 3509502 |
| 15   | `dom-slz` | São Luís              | MA  | 2111300 |
| 16   | `dom-sgo` | São Gonçalo           | RJ  | 3304904 |
| 17   | `dom-mcz` | Maceió                | AL  | 2704302 |
| 18   | `dom-dqc` | Duque de Caxias       | RJ  | 3301702 |
| 19   | `dom-the` | Teresina              | PI  | 2211001 |
| 20   | `dom-nat` | Natal                 | RN  | 2408102 |

19 estão **enabled** por padrão. Brasília fica disabled porque o DOE-DF cobre tanto estado quanto município (DF é unidade federativa única).

### Cobertura do Querido Diário

Cada cidade tem milhares de gazettes históricas. Exemplos (consultados em 2026-05-14):

- Goiânia: 8.960 gazettes
- Manaus: 7.517 gazettes
- Belém: 4.744 gazettes

### Adicionar mais cidades

Outras cidades brasileiras (são +500 no QD): edite `sources` via SQL ou pelo [/app/admin/sources](../src/routes/app/admin/sources.tsx):

```sql
insert into public.sources (code, name, level, uf, city, scraper_adapter, adapter_config, enabled)
values ('dom-<3-letras>', 'Diário Oficial do Município de <Nome>', 'municipal', 'XX', '<Nome>',
        'querido-diario', '{"ibge":"<7-digits>"}'::jsonb, true);
```

IBGE codes: https://servicodados.ibge.gov.br/api/v1/localidades/municipios

## Fontes (links)

- [Querido Diário API docs](https://docs.queridodiario.ok.org.br/en/latest/using/public-api.html)
- [Querido Diário (Open Knowledge BR)](https://queridodiario.ok.org.br/)
- [INLabs / Imprensa Nacional](https://inlabs.in.gov.br/)
- [Lista de DOEs (Jusbrasil)](https://www.jusbrasil.com.br/diarios/)
