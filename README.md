# Demonstração de Frota — Gestão Tech

Sistema de demonstração de gestão de frota para **Tarcísio Araújo Transportes**, desenvolvido pela **Gestão Tech**.

## Stack definida

- **Frontend:** HTML, CSS e JavaScript puro, sem React/Next.js.
- **Hospedagem:** Vercel para os arquivos estáticos e funções de API.
- **Banco de dados:** Neon PostgreSQL.
- **Backend:** funções serverless JavaScript em `api/`.
- **Interface legada:** permanece em `index.html`, `css/` e `js/`, incluindo os módulos de frota, manutenção, almoxarifado, combustível, óleo e relatórios.

Todos os dados de exemplo no protótipo são fictícios.

## Estado atual da migração

A branch prepara a nova estrutura de publicação e a conexão com Neon. **A persistência operacional da interface ainda usa LocalStorage nesta etapa**; os módulos existentes não foram convertidos integralmente para consultar a API e gravar no Neon. Não considere a aplicação pronta para uso multiusuário/produção até terminar essa migração.

## Executar localmente

1. Instale uma versão LTS atual do Node.js.
2. Instale as dependências:

   ```bash
   npm install
   ```

3. Copie `.env.example` para `.env.local` e preencha `DATABASE_URL` com a connection string do Neon.
4. Inicie a Vercel CLI local:

   ```bash
   npm run dev
   ```

5. Abra a URL local informada pela Vercel CLI.

Para validar a estrutura estática:

```bash
npm run build
npm run test:legacy
```

O build verifica arquivos obrigatórios, mas não substitui testes de navegador ou testes de integração com Neon.

## Configurar Neon

1. Crie um projeto e um banco no Neon.
2. Copie a connection string PostgreSQL, preferencialmente a string pooled para as funções serverless.
3. Configure `DATABASE_URL` nas variáveis de ambiente do projeto Vercel (Development, Preview e Production conforme o ambiente).
4. Aplique o script `database/migrations/001_initial_schema.sql` no banco de desenvolvimento correto.
5. Acesse `/api/v1/health`; uma resposta com `"database": "connected"` confirma que a função conseguiu executar uma consulta simples.

Nunca exponha `DATABASE_URL` no JavaScript do navegador ou em arquivos públicos. A conexão é usada somente pelas funções em `api/`.

## Publicar na Vercel

1. Importe o repositório GitHub `gestaotech/fleet-demo` no painel da Vercel.
2. Configure as variáveis de ambiente, incluindo `DATABASE_URL`, antes de testar a API.
3. Use o diretório raiz do repositório como Root Directory.
4. Não configure um build de Next.js; o projeto é servido como HTML/CSS/JS e funções serverless.
5. Faça o deploy de uma branch de teste e confirme a resposta de `/api/v1/health` antes de promover a versão.

O arquivo `vercel.json` define cabeçalhos de segurança básicos e limites para as funções.

## Organização

```
index.html
css/                         # estilos
js/                          # módulos, regras e interface em JavaScript
api/v1/health.js             # verificação de conectividade com Neon
database/migrations/         # SQL versionado para o Neon
scripts/check-static.js      # validação estrutural da interface
vercel.json                  # configuração de publicação
```

## Próximas etapas necessárias

1. Implementar login real no servidor e sessões seguras em cookies HttpOnly.
2. Substituir a sessão simulada e a persistência LocalStorage por chamadas autenticadas à API.
3. Migrar gravação/leitura dos dados operacionais para Neon, com isolamento por empresa e validação no servidor.
4. Adicionar testes de integração de API e banco, incluindo permissões e isolamento multiempresa.
5. Executar build, testes e uma validação completa em Preview na Vercel.

A API não deve aceitar gravações operacionais até que autenticação e autorização por empresa estejam implementadas. Não coloque dados reais de clientes em uma demonstração.
