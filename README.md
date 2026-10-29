# Sistema de Gestão de Frota — Gestão Tech

Sistema de gestão de frota para **Tarcísio Araújo Transportes**, desenvolvido pela **Gestão Tech**.

## Stack

- **Interface:** HTML, CSS e JavaScript puro (sem React, Next.js, TypeScript ou Prisma).
- **Backend:** funções serverless em JavaScript (CommonJS) na pasta `api/`, publicadas pela Vercel.
- **Banco:** PostgreSQL no **Neon**, acessado somente pelo servidor (`@neondatabase/serverless`).
- **Sessão:** token aleatório em cookie `HttpOnly`; no banco fica apenas o hash SHA-256 do token.
- **Senhas:** `scrypt` nativo do Node.js, com salt individual.

## Estado atual da migração

| Área | Situação |
|---|---|
| Login, logout e sessão no servidor | **Integrado** (cookies seguros, CSRF, bloqueio por tentativas, expiração e revogação) |
| Usuários e permissões por módulo | **Integrado** (criação, edição, ativação, troca de senha; validação no servidor) |
| Persistência dos dados operacionais | **Integrado ao banco** via `fleet_workspace_state` (estado por empresa, com revisão) |
| Controle de atualizações simultâneas | **Integrado** (gravação recusada com 409 quando a revisão está desatualizada) |
| Auditoria | **Integrada** (login, usuários, alterações de estado; tabela imutável por gatilho) |
| Regras de negócio | **Preservadas** (mesmos módulos em `js/core`, com testes de regressão) |
| Validação de integridade no servidor | **Integrada** (referências, quantidades positivas, estoque não negativo) |
| Conexão com o Neon | **Conectividade confirmada pelo endpoint de saúde**; isso não substitui testes completos de todos os fluxos |
| Deploy e fluxos completos | **Validar por ambiente**; o build/CI não comprova por si só todos os fluxos funcionais |

A migração **ainda não está concluída** do ponto de vista de arquitetura final: os dados operacionais são
guardados como um estado JSON por empresa (decisão para migrar sem reescrever os módulos). Tabelas
relacionais por entidade (veículos, peças, movimentações etc.) são o próximo passo recomendado.

## Estrutura

```
index.html                   interface (uma página, rotas por hash)
css/                         estilos
js/                          interface e regras
  api.js                     cliente HTTP (CSRF, erros padronizados)
  storage.js                 estado operacional via API (sem LocalStorage)
  data.js                    fixture fictícia para seed/testes; excluída do pacote público
  app.js                     boot, sessão, login, fila de gravação
  modules/                   telas (administrador, veículos, manutenção, óleo, combustível, almoxarifado, relatórios)
  core/                      regras de negócio puras (custos, consumo, óleo, saldo, períodos)
api/v1/                      funções serverless
  health.js                  verificação do banco
  auth/login.js              POST   login
  auth/logout.js             POST   logout
  auth/session.js            GET    sessão atual
  workspace.js               GET/PUT estado operacional
  users/index.js             GET/POST usuários da empresa
  users/[id].js              PATCH  editar usuário
lib/                         código compartilhado do servidor
database/migrations/         SQL versionado (001, 002, 003)
scripts/                     migrações, seed, criação de administrador, servidor local, verificações
tests/                       testes unitários, de integração e legados
vercel.json                  cabeçalhos de segurança (CSP, HSTS etc.) e limites das funções
```

## 1. Instalação local

Requisitos: **Node.js 22 ou superior** e npm.

```bash
npm install
cp .env.example .env.local      # Windows: copie o arquivo e edite pelo editor
```

Preencha `.env.local` (veja a seção 3). Nunca versione este arquivo.

## 2. Configurar o Neon

1. Crie um projeto no Neon e, dentro dele, um banco para desenvolvimento (ex.: `fleet_demo_dev`).
2. Crie também um **banco de teste separado** (ex.: `fleet_demo_teste`). Os testes de integração apagam o schema público desse banco.
3. Copie as connection strings (formato `postgresql://...?sslmode=require`).
4. Use a string **com pooler** em `DATABASE_URL` (funções serverless) e, se quiser, a direta em `MIGRATION_DATABASE_URL`.

## 3. Variáveis de ambiente

Todas estão documentadas em `.env.example`. Resumo:

| Variável | Obrigatória | Uso |
|---|---|---|
| `DATABASE_URL` | sim | Banco usado pelas funções `/api` (Neon). Só no servidor. |
| `MIGRATION_DATABASE_URL` | não | Banco para migrações e seed (padrão: `DATABASE_URL`). |
| `IP_HASH_SALT` | sim em produção | Salt do hash de IP nos registros. |
| `SESSION_TTL_HOURS` | não | Validade da sessão (1 a 720 h; padrão 8). |
| `TRUSTED_PROXY_HEADERS` | só na Vercel | `"true"` faz o limite de tentativas usar `x-forwarded-for`. |
| `ALLOW_SEED`, `SEED_*` | só no seed | Seed de dados de exemplo; recusado em produção. |
| `TEST_DATABASE_URL`, `TEST_DATABASE_RESET` | só nos testes de integração | Banco descartável. `TEST_DATABASE_RESET=sim` é obrigatório. |
| `PORT` | não | Porta do `npm start` (padrão 8080). |

## 4. Migrações

```bash
npm run db:migrate
```

- Aplica os arquivos de `database/migrations/` em ordem, cada um em transação.
- Registra o checksum de cada migração em `schema_migrations`. Se uma migração já aplicada for
  alterada, o comando para com erro: crie uma **nova** migração em vez de editar a antiga.
- Rodar de novo não altera nada quando o banco já está atualizado.

## 5. Primeiro acesso

### Inicialização com dados fictícios (somente desenvolvimento/teste)

```bash
ALLOW_SEED=true SEED_ADMIN_PASSWORD="senha-com-10-ou-mais" npm run db:seed
```

Cria a empresa, o administrador com todos os módulos e o estado inicial com dados fictícios. Execute apenas em banco de desenvolvimento/teste; o seed recusa ambiente de produção. Não existe senha padrão. As fixtures não são carregadas pelo navegador nem incluídas no pacote estático público.

### Produção (sem dados de exemplo)

```bash
CONFIRMAR_CRIACAO_ADMIN=sim ADMIN_LOGIN=joao.admin ADMIN_NOME="João Administrador" \
ADMIN_SENHA="senha-forte-de-10-ou-mais" EMPRESA_NOME="Nome da Empresa" EMPRESA_SLUG="nome-da-empresa" \
npm run db:criar-admin
```

- Use variáveis apenas na sessão do terminal, sem gravá-las em arquivos.
- O script não altera usuário existente e nunca imprime a senha.
- Depois, crie os demais usuários pela tela **Administrador > Usuários e permissões**.

## 6. Rodar localmente

```bash
npm start            # http://localhost:8080 (interface + rotas /api simuladas)
```

`npm start` usa `scripts/serve.js`, que reproduz o roteamento da Vercel sem a CLI. Requer `DATABASE_URL`.

Para o ambiente da Vercel (com o runtime real das funções):

```bash
npx vercel link      # uma vez, com login na Vercel
npm run dev          # vercel dev
```

## 7. Testes

| Comando | O que verifica | Requisitos |
|---|---|---|
| `npm test` | Testes unitários: segurança, HTTP, validação de estado e usuários, imports entre módulos | nenhum |
| `npm run test:legacy` | Regras de negócio (custos, consumo, óleo, almoxarifado, relatórios), roteamento e cliente de API | nenhum |
| `npm run test:integration` | API real contra PostgreSQL: login, CSRF, permissões, concorrência, invariantes, auditoria imutável, isolamento entre empresas, usuários, falha do banco | `TEST_DATABASE_URL` e `TEST_DATABASE_RESET=sim` |
| `npm run build` | Arquivos obrigatórios e migrações presentes | nenhum |
| `npm run test:all` | build + legados + unitários + integração | todos |

Para a integração, use um banco **descartável**. O script recusa rodar se `TEST_DATABASE_URL` for igual a `DATABASE_URL`.

Alternativa local sem Neon: qualquer PostgreSQL 14+ acessível (instalado ou em contêiner) serve para os testes e para o desenvolvimento. O driver `pg` é usado automaticamente para hosts que não são `*.neon.tech`.

```bash
TEST_DATABASE_URL="postgresql://postgres:SENHA@localhost:5432/fleet_test" TEST_DATABASE_RESET=sim npm run test:integration
```

## 8. Publicar na Vercel

1. Importe o repositório `gestaotech/fleet-demo` no painel da Vercel.
2. **Root Directory:** raiz do repositório. **Framework Preset:** *Other*. Não configure build de Next.js.
3. Em **Settings > Environment Variables**, cadastre `DATABASE_URL` (Preview e Production, conforme o caso),
   `IP_HASH_SALT`, `SESSION_TTL_HOURS` (opcional) e `TRUSTED_PROXY_HEADERS=true`.
   Não cadastre `TEST_DATABASE_*` nem `ALLOW_SEED` em produção.
4. Faça o deploy de uma **branch de preview** primeiro.
5. Antes de promover para produção, confira o endpoint de saúde (seção 9).
6. Em produção, crie o primeiro administrador com `npm run db:criar-admin` (apontando `MIGRATION_DATABASE_URL`
   para a conexão de produção), **uma única vez**.

As migrações não rodam automaticamente no deploy: execute `npm run db:migrate` com a conexão de produção
antes de liberar a nova versão, depois do backup/ponto de restauração do Neon.

## 9. Verificar o endpoint de saúde

```bash
curl https://SEU-DOMINIO/api/v1/health
```

- `200` com `{"ok":true,"service":"fleet-demo-api","database":"connected"}`: função e banco respondem.
- `503` com `"database":"not_configured"`: `DATABASE_URL` não está definida.
- `503` com `"database":"unavailable"`: o banco não respondeu. A causa não é exposta na resposta.

## 10. Segurança (resumo)

- Autorização sempre no servidor: sessão validada no banco a cada request, permissão por módulo e
  `companyId` vindo da sessão, nunca do navegador.
- Sessão: token aleatório de 256 bits, só o hash no banco, cookie `HttpOnly`, `Secure` e `SameSite=Lax`,
  expiração e revogação imediatas (logout, desativação, troca de senha, remoção de vínculo).
- CSRF por duplo envio + verificação de origem em toda alteração.
- Limite de tentativas no PostgreSQL (5 por login e 30 por IP em 15 minutos, bloqueio de 15 minutos).
- Respostas de login idênticas para usuário inexistente, senha errada e usuário inativo.
- Auditoria append-only (gatilho no banco impede `UPDATE` e `DELETE`). Metadados sem senha, token ou cookie.
- Cabeçalhos: CSP restritiva, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`.
- Erros internos nunca são devolvidos ao cliente; o banco é reportado como `indisponível` sem detalhes.

Detalhes e contratos da API: [`docs/api.md`](docs/api.md).

## 11. Limitações conhecidas

1. **Conectividade do Neon:** a verificação `/api/v1/health` retornou `{"ok":true,"service":"fleet-demo-api","database":"connected","configuracao":"ok"}` no ambiente verificado. Isso confirma a conectividade do endpoint com o banco naquele momento, mas não comprova todos os fluxos de login, gravação, permissões e relatórios. Confirme as migrações e execute os testes de integração em banco de teste separado antes de liberar alterações.
2. **Estado operacional em JSON por empresa.** Gravar o estado inteiro é simples e seguro contra conflitos,
   mas não permite consultas relacionais nem permissões de leitura por coleção (a leitura é da empresa inteira;
   a escrita é controlada por módulo).
3. **Limite de tentativas e bloqueios** são persistidos por chave de tempo; em alta concorrência podem
   existir poucas tentativas além do limite.
4. **Último administrador:** a regra é verificada antes da gravação. Duas edições simultâneas e opostas
   podem, em tese, passar pela verificação (ver `api/v1/users/[id].js`).
5. **Login global:** o nome de acesso é único em toda a plataforma (não por empresa).
6. **Uma empresa ativa por sessão:** a troca de empresa ainda não tem tela; o login escolhe o primeiro vínculo ativo.
7. **Sem ação de reset de senha** pela interface: o administrador redefine a senha do usuário.
8. **Interface:** as telas de manutenção, combustível e relatórios continuam as mesmas do sistema;
   foram testadas nos fluxos de cadastro, gravação e permissão, mas não há teste automatizado de navegador.
9. **Deploy e validação funcional:** um check de build/CI bem-sucedido não comprova todos os fluxos no ambiente publicado. Validar login, leitura e gravação, permissões, auditoria e relatórios em preview antes de liberar ao cliente.
10. **Exclusão de registros:** a interface não remove registros (apenas desativa usuários e veículos). A exclusão
    autorizada precisa ser planejada antes de ser exposta ao cliente.
11. **Validação parcial de regras no servidor:** a API valida formato, referências e estoque, mas não todas as
    regras específicas de cada módulo (consumo de combustível, vencimento de óleo). A interface continua
    aplicando essas regras.
12. **Conflito de gravação:** quando a revisão está defasada, a alteração local é bloqueada e pode ser baixada
    em JSON pela interface (botão "Baixar alterações não salvas"). O usuário precisa recarregar a página e reaplicar
    manualmente.

## 12. Próximas etapas

1. Confirmar que as migrações necessárias estão aplicadas no ambiente correto e rodar `npm run test:integration` contra um banco de teste separado (nunca contra o banco operacional).
2. Validar em preview da Vercel `/api/v1/health`, login, leitura/gravação, permissões, auditoria e relatórios.
3. Migrar o estado JSON para tabelas relacionais por entidade, mantendo as regras de `js/core`.
4. Testes de navegador (ponta a ponta) para os fluxos principais.
5. Troca de empresa para usuários com vínculo em mais de uma empresa.
6. Limpeza periódica automatizada (cron) para sessões e tentativas expiradas.
