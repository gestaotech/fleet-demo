# Gestão de Frota — Gestão Tech

Base em evolução para o sistema de gestão de frota da **Tarcísio Araújo Transportes**, desenvolvido pela **Gestão Tech**.

> **Estado atual:** a Fase 1 estabelece a fundação técnica (Next.js, React, TypeScript, Prisma, PostgreSQL, autenticação, sessões, permissões e auditoria). Ela **não representa ainda a migração completa** das telas e dos módulos operacionais do protótipo legado. Não use este repositório como produção sem concluir a configuração, os testes e as revisões de segurança.

Todos os dados do protótipo legado são fictícios. Não coloque credenciais, tokens, dados pessoais reais ou segredos no Git.

## Tecnologias da fundação

- Next.js e React com TypeScript estrito.
- PostgreSQL via Prisma ORM.
- Sessões assinadas com JWT em cookie HttpOnly e validação da sessão no banco.
- Argon2 para verificação de hashes de senha.
- Zod para validação de entradas.
- Vitest para testes TypeScript; Node.js `node:test` para a suíte do protótipo legado.

## Requisitos

- Node.js compatível com a versão definida pelo ambiente de desenvolvimento/implantação.
- npm.
- PostgreSQL acessível para executar migrações e testes de integração.
- Variáveis de ambiente configuradas a partir de `.env.example`.

## Configuração local

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Copie `.env.example` para `.env` (ou `.env.local`, conforme seu ambiente) e preencha as variáveis. **Não comite o arquivo com valores reais.**
3. Gere o cliente Prisma:

   ```bash
   npm run db:generate
   ```

4. Valide o schema:

   ```bash
   npm run db:validate
   ```

5. Em um banco de desenvolvimento descartável, aplique as migrações:

   ```bash
   npm run db:migrate
   ```

6. Inicie o servidor Next.js:

   ```bash
   npm run dev
   ```

Abra `http://localhost:3000`.

### Variáveis de ambiente

| Variável | Uso |
|---|---|
| `DATABASE_URL` | URL PostgreSQL usada pelo Prisma para as conexões da aplicação. |
| `DIRECT_DATABASE_URL` | URL direta PostgreSQL usada pelo Prisma nas operações que precisam de conexão direta e nas migrações. |
| `SESSION_SECRET` | Segredo aleatório para assinar/verificar tokens de sessão; use pelo menos 32 caracteres em produção. |
| `SESSION_TTL_HOURS` | Duração da sessão em horas; padrão do código: 8. |
| `TEST_DATABASE_URL` | Banco PostgreSQL separado para testes de integração, quando esses testes forem configurados para usá-lo. |
| `ALLOW_SEED` | Deve ser explicitamente definido como `true` para permitir a execução do seed. |
| `SEED_ADMIN_EMAIL` | E-mail do administrador inicial para o seed. |
| `SEED_ADMIN_NAME` | Nome do administrador inicial para o seed. |
| `SEED_ADMIN_PASSWORD` | Senha inicial do administrador; o seed exige no mínimo 12 caracteres. |
| `SEED_RESET_PASSWORD` | Só use `true` conscientemente para permitir que o seed redefina uma senha existente. |

Gere um segredo local com:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Não reutilize o segredo de desenvolvimento em produção. Não habilite o seed em produção.

## Comandos úteis

```bash
npm run dev             # servidor de desenvolvimento
npm run build           # gera Prisma Client e compila o Next.js
npm start               # inicia a versão compilada
npm run lint             # ESLint
npm run typecheck        # verificação TypeScript
npm run db:generate      # gera Prisma Client
npm run db:validate      # valida o schema Prisma
npm run db:migrate       # migra banco de desenvolvimento
npm run db:deploy        # aplica migrações existentes no ambiente alvo
npm test                 # testes TypeScript reconhecidos pelo Vitest
npm run test:legacy      # testes JavaScript do protótipo com node:test
npm run test:all         # executa as duas suítes em sequência
npm run test:unit        # testes unitários TypeScript
npm run test:integration # testes de integração TypeScript
npm run test:security    # testes de segurança TypeScript
```

**Atenção aos testes:** o Vitest está configurado para arquivos `tests/**/*.test.ts`; os testes `.test.js` pertencem à suíte legada e precisam ser executados com `npm run test:legacy`. A suíte de integração depende de banco de teste real e de configuração explícita. Nunca aponte testes para dados de clientes ou produção.

## Estrutura da fundação atual

```
src/
  app/                         # rotas Next.js, páginas e endpoints
    (auth)/login/              # entrada e ação de login
    (auth)/select-company/     # seleção da empresa ativa
    (dashboard)/dashboard/     # área autenticada inicial
    api/v1/                    # endpoints versionados
  config/permissions.ts        # catálogo de permissões por módulo
  lib/
    auth/                      # autenticação, sessões, guards e consultas
    audit/                     # serviço de auditoria
    db/prisma.ts               # instância compartilhada do Prisma
    security/                  # utilitários relacionados à segurança
    validations/               # schemas de validação
  modules/vehicles/rules/      # regras de negócio portadas para TypeScript
prisma/
  schema.prisma                # modelos, relações e enums
  migrations/                  # migrações versionadas
  seed.ts                      # seed protegido por variáveis de ambiente
tests/
  unit/                        # testes unitários TypeScript
  security/                    # testes de segurança TypeScript
  *.test.js                    # testes do protótipo legado
```

Os arquivos `index.html`, `css/` e `js/` permanecem no repositório como protótipo funcional legado. A presença deles não significa que as telas já foram migradas para Next.js.

## Segurança e arquitetura

- Todas as operações com dados de empresa devem validar a sessão, a associação ativa do usuário à empresa e as permissões no servidor. Ocultar itens na interface não substitui autorização no servidor.
- Toda consulta ou alteração multiempresa deve ser limitada à empresa do contexto autenticado; não confiar em `companyId` enviado pelo navegador sem validar o vínculo.
- Manter segredos fora do Git e usar cookies seguros em produção.
- Tratar auditoria e falhas de auditoria explicitamente conforme a criticidade da operação; não presumir que uma ação foi auditada sem confirmar a gravação.
- A política de confiança para cabeçalhos de IP encaminhados precisa corresponder ao proxy/plataforma real de implantação.
- As integrações futuras entre produtos Gestão Tech devem usar contratos de API definidos, autenticação segura, isolamento multiempresa, identificadores consistentes, auditoria e versionamento. Elas podem ser implementadas sob demanda, mas a arquitetura deve permitir essa evolução.

## Regras do protótipo que devem ser preservadas

A migração dos módulos precisa manter, com testes, pelo menos estas regras:

- Retiradas de almoxarifado não podem deixar o estoque negativo; peças externas não alteram o saldo interno.
- Custos históricos registrados não mudam quando o preço atual do catálogo muda.
- Consumo de combustível deve usar registros válidos de tanque cheio e informar quando não houver dados suficientes.
- A troca de óleo vence pelo primeiro limite atingido: quilometragem ou tempo.
- Custos de manutenção, combustível e troca de óleo não podem ser contados duas vezes.
- Histórico, filtros de período e isolamento entre empresas precisam ser preservados.

## Estado da Fase 1 e próximos passos

A Fase 1 é a fundação, não a entrega de todos os módulos operacionais. Antes de avançar, valide em ambiente controlado: instalação limpa, variáveis, Prisma/migrações, lint, TypeScript, build, suítes de teste, login/logout, expiração/revogação de sessão, permissões, isolamento entre empresas e auditoria. Registre os resultados reais no pull request; não considere uma verificação concluída sem executá-la.

## Protótipo legado — acesso demonstrativo

O protótipo em `index.html` usa dados locais fictícios e autenticação simulada. As credenciais demonstrativas descritas nos materiais do protótipo **não são credenciais da fundação Next.js** e não devem ser reutilizadas em produção. O LocalStorage do navegador não é banco compartilhado e não fornece segurança multiempresa.
