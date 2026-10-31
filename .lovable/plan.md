# Auditoria do estado atual — Diário Oficial Scanner

Nada foi alterado. Relatório baseado em leitura de código + consultas ao banco (feitas agora).

## Resumo em uma linha

O front e o schema estão maduros, mas **a instância remixada está vazia e o pipeline nunca liga**: 0 usuários, 0 fontes, 0 linhas em `internal.runtime_config` e **nenhum job de cron criado**. Segurança: nenhuma chave de terceiros no repositório, mas há 3 desvios reais da sua regra de Vault.

---

## 1. Cadastro e autenticação

Funciona de ponta a ponta (pelo código):
- Cadastro `/signup` → `useAuthActions.register` (`src/hooks/use-auth-actions.tsx`) com validação Zod e `emailRedirectTo` para `/app`.
- Login, 2FA TOTP (`login` + `verifyTotp`, tela em `src/routes/login.tsx`), recuperação de senha (`forgot-password.tsx`, `reset-password.tsx`), MFA enroll/unenroll, export e exclusão de conta em `src/routes/app/account.tsx` (`export_my_data`, `delete_my_account`).
- Sessão persistida pelo cliente Supabase e propagada por `AuthProvider` (`src/hooks/use-auth.tsx`) — não depende de SSR, então voltar depois mantém a sessão.
- Provisionamento automático: trigger `handle_new_user` cria `profiles` e `user_roles`; **o primeiro usuário vira `admin`**; convites pendentes (`invites`) definem o papel dos demais. Nenhum passo manual seu.
- RLS: verificado no banco — `profiles`, `terms`, `matches`, `notifications`, `user_roles` têm policies por `auth.uid()` + policies de admin. Papéis estão em tabela separada com `has_role()` SECURITY DEFINER (padrão correto, sem escalonamento por profile).

Pela metade / frágil:
- **Guarda de rota é só client-side**: `src/routes/app.tsx` usa `useEffect` + `navigate('/login')`; não existe layout `_authenticated`. Há um flash de conteúdo antes do redirect e a proteção real depende 100% do RLS (que está correto, então não é vazamento — é UX/arquitetura).
- **Redirecionamento forçado de onboarding**: admin sem Anthropic testada é jogado para `/app/onboarding` a cada navegação (`app.tsx:113-119`). Se a view `integration_status` demorar/falhar, o admin fica em loop de navegação.
- `AuthProvider` tem um timeout de 5s que solta `loading=false` mesmo sem resposta do Supabase — mascara falha de rede como "deslogado".
- Sem tratamento explícito de `PASSWORD_RECOVERY`/refresh: só `onAuthStateChange` genérico.

Não dá para verificar só lendo código:
- Se a confirmação de e-mail está exigida ou auto-confirmada nas configurações de Auth, e se o envio de e-mail transacional está ativo. Hoje o banco tem **0 usuários**, então nada disso foi exercitado nesta instância.
- Se o e-mail de reset chega (depende do provedor de e-mail do projeto).

Ponto que "funciona por acidente": a regra "primeiro usuário = admin" usa `not exists (select 1 from auth.users where id <> new.id)`. Com o banco vazio, quem se cadastrar primeiro — qualquer pessoa que achar a URL — vira admin da sua instância. Signup está aberto.

---

## 2. Chaves de API

O que está correto:
- **Nenhuma chave de terceiro no repositório.** `.env` só tem `SUPABASE_URL`, `PROJECT_ID` e a publishable key (público por natureza).
- Chaves de provedores vivem no Vault via `admin_set_integration_secret` (SECURITY DEFINER, com `has_role(admin)`), com ponteiro em `public.integration_secrets` (só `vault_id`, nunca o valor). RLS: só admin lê a tabela de ponteiros.
- Leitura dos valores é exclusivamente server-side: `_internal_get_integration_secrets` exige claim `service_role`; as edge functions (`ai-classifier`, `test-source`, `test-integration`, `scrape-*`) leem por ali. Nenhum endpoint devolve o valor da chave para a tela.
- Service role key nunca sai do servidor (`client.server.ts`, `_shared/supabase.ts`).

Desvios da sua regra (não corrigidos):
1. **A chave é digitada em campo de texto no cliente e trafega pelo browser.** `src/routes/app/onboarding.tsx` e `src/components/integrations/ProviderEditDialog.tsx` mandam a chave em claro no body de `test-integration` (`inline.secrets`) e depois no RPC `admin_set_integration_secret`. É HTTPS e o valor nunca volta, mas o texto passa pela página — exatamente o que sua regra proíbe. Vale para Anthropic, Firecrawl, Resend, senha INLabs e Evolution.
2. **`admin_integration_secret_status` é SECURITY DEFINER sem checagem de papel** e com EXECUTE para `anon`/`authenticated`. Não vaza valor, mas qualquer um pode listar quais segredos existem por provedor. Compare com `admin_list_integration_secrets`, que checa admin.
3. **View `integration_status` sem `security_invoker`** (confirmado no banco: `relrowsecurity=false`, dona `postgres`, EXECUTE/SELECT para `anon`). Ela expõe `provider, enabled, last_tested_at, last_test_ok, last_test_error` de `integration_configs` **contornando o RLS de admin** — inclusive para não autenticados. Mensagens de erro de provedor podem conter detalhes de infraestrutura.

Observação adicional: `internal.runtime_config` guarda `anon_key`/`service_role_key` em texto no schema `internal` (fora da Data API). Aceitável, mas não é Vault.

Não verificável por leitura: se alguma chave real já foi colada em algum lugar antes do remix — hoje `integration_secrets` e `integration_configs` estão **vazios**, então nada configurado ainda.

---

## 3. Onboarding

Existe: `src/routes/app/onboarding.tsx` (874 linhas), 7 passos — Boas-vindas, Anthropic, INLabs, Firecrawl, Canais (Resend/Evolution com QR do WhatsApp), Ativar pipeline, Concluído. Cada passo testa a credencial antes de salvar.

O que está pela metade:
- **Não é modal** e **não guarda progresso**: `const [step, setStep] = useState(0)` — fechar a aba volta para o passo 1. O que já foi salvo persiste (integrações), mas a posição no fluxo não.
- **Não some depois de concluído**: não existe flag de "onboarding concluído" em `profiles` nem em lugar nenhum. O que decide é só "Anthropic testada com sucesso" (`app.tsx`). Ou seja: enquanto a Anthropic não passar, o admin é redirecionado sempre; depois que passar, o wizard nunca mais aparece — mesmo que nada mais esteja configurado.
- **Só existe para admin**: usuário comum (`isAdmin=false`) é mandado para `/app` sem nenhuma orientação.
- Botão final leva para `/app/terms`, mas o menu chama a tela de "Entidades"/"Temas" — inconsistência de nomes entre wizard e navegação.

O que hoje o usuário só descobre por tentativa e erro:
- **Cadastrar fontes.** A tabela `sources` está vazia (0 linhas) e o wizard não cria nenhuma. Sem fonte, o pipeline não tem o que raspar. Isso é o furo mais grave do onboarding.
- **`internal.runtime_config` não tem linha `id=1`** — `admin_apply_runtime` faz `update ... where id = 1`, atinge 0 linhas e retorna sucesso silencioso. O wizard vai dizer "Pipeline ativo" sem ter ativado nada.
- **Nenhum job de cron existe** (`cron.job` vazio). Mesmo com runtime configurado, nada roda a cada 30 min; só disparo manual.
- `bootstrap-runtime` exige uma anon key em formato JWT legado (`eyJ...`); este projeto usa `sb_publishable_...` e o wizard envia justamente essa. Tende a falhar com "não é um JWT legacy".
- `app_settings` vazia (0 linhas) — o limiar de confiança da IA cai no default do código.
- Preferências de notificação, telefone E.164 e vínculo termo↔fonte (`term_sources`) não são cobertos pelo wizard.

---

## 4. Consistência visual (diagnóstico apenas)

O `src/styles.css` já declara a paleta "Viver de IA" (navy `#02162A`, indigo `#6366F1`, âmbar `#F59E0B`, esmeralda `#10B981`) com tokens semânticos completos, inclusive tokens extras de superfície/texto do DS. Base boa.

Desvios visíveis:
- **Tipografia**: nenhuma família é carregada — sem `<link>` de fonte no `__root.tsx` e sem `--font-*`. A app roda na fonte padrão do sistema, então não bate com o DS de referência.
- **Cores hardcoded** fora do sistema de tokens: `bg-emerald-600 text-white`, `text-emerald-700 dark:text-emerald-400`, `border-emerald-500/40` em `ProviderEditDialog.tsx`, `onboarding.tsx` e outros — quebram tema/dark mode e ignoram os tokens `success/warning` já definidos.
- **Escala tipográfica ad-hoc**: títulos variam entre `text-xl`, `text-2xl`, `text-3xl` sem regra por nível de página; uso de `text-[10px]` avulso.
- **Componentes**: shadcn padrão sem as variantes do DS (botões, badges de status, cards de métrica). Estados de erro/sucesso são divs improvisadas em vez de um componente de alerta único.
- Honestidade: consegui extrair pouquíssimo do site do DS por HTTP (a página é client-side; só recuperei `#0A1F3B`). Uma comparação fiel de espaçamento/tipografia exige eu abrir o site no navegador e capturar telas — posso fazer isso se você quiser.

---

## Prioridade sugerida (risco antes de acabamento)

1. **Fechar o cadastro aberto** antes de qualquer coisa: hoje o primeiro a se cadastrar vira admin. Criar sua conta agora ou restringir signup a convite.
2. **View `integration_status` sem RLS** exposta ao anônimo → `security_invoker` + revogar `anon`.
3. **`admin_integration_secret_status` sem checagem de admin** → adicionar `has_role`.
4. **Caminho de entrada das chaves** sem campo de texto no cliente (mover para função servidor dedicada / segredos do projeto), conforme sua regra.
5. **Runtime quebrado**: seed de `internal.runtime_config` (id=1), `app_settings`, criação dos jobs de cron e correção do `bootstrap-runtime` para a key nova.
6. **Seed das fontes** (`sources`) — sem isso o produto não coleta nada.
7. **Onboarding**: persistir progresso + flag de conclusão em `profiles`, cobrir fontes/termos/notificações, versão para usuário não-admin.
8. **Guarda de rota** `_authenticated` no lugar do `useEffect`.
9. **Consistência visual**: carregar as fontes do DS, eliminar cores hardcoded, padronizar escala e componentes de estado.

---

## Perguntas antes de eu propor implementação

1. Esta instância é só sua (single-tenant, você admin) ou vai ter clientes se cadastrando? Isso muda tudo no item 1 e no onboarding.
2. Sobre as chaves: você quer (a) chaves fixas do projeto, definidas por você em Configurações → Secrets, sem UI nenhuma; ou (b) cada cliente informa a chave dele, e aí preciso desenhar um caminho de entrada que não passe por campo de texto na tela — o que na prática significa formulário servidor dedicado ou OAuth quando o provedor suportar. Qual dos dois?
3. Quer que eu popule as fontes (DOU/INLabs + Querido Diário + DOEs) como parte da correção, ou você prefere cadastrar manualmente?
4. Para o item 4, autorizo abrir o site do DS no navegador e comparar telas lado a lado? Sem isso o diagnóstico visual fica no nível acima.
