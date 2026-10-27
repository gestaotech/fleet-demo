# Operação: backup, migração e implantação

## Backup e restauração (Neon)

1. **Antes de qualquer migração**, crie um branch do banco no Neon (ou um snapshot/ponto no tempo)
   com nome datado (ex.: `backup-2026-10-27-pre-migracao`).
2. **Teste de restauração:** restaure o backup em um banco separado, execute `npm run db:migrate`
   e confirme que a aplicação sobe. Faça isso uma vez por ambiente.
3. **Retenção:** mantenha pelo menos os últimos 30 dias de pontos de restauração do Neon
   (Branches/Snapshots) e um backup externo mensal exportado por `pg_dump`.
4. **Nunca** execute `DROP SCHEMA`, `DROP TABLE` ou `TRUNCATE` em produção sem o backup acima.

## Migração

1. Aplique as migrações primeiro no banco de desenvolvimento/teste e rode `npm run test:integration`.
2. Em produção, execute `npm run db:migrate` com `MIGRATION_DATABASE_URL` apontando para a conexão direta
   (sem pooler) do Neon, antes de publicar a nova versão.
3. Migrações são idempotentes na estrutura (colunas, índices, restrições, gatilhos usam `IF NOT EXISTS` ou verificação prévia).
   A migração `002` não pode ser editada depois de aplicada: o executor recusa arquivos alterados.
   Para alterar a estrutura, crie `004_*.sql`, `005_*.sql` etc.
4. Migrações nunca apagam dados. Se for necessário remover algo, faça em uma migração nova e documentada.

## Limpeza periódica

A aplicação remove sessões expiradas há mais de 30 dias e registros de tentativas de login antigos a cada login
bem-sucedido. Para garantir a limpeza mesmo em baixo uso, agende (cron externo) uma chamada periódica ou
execute manualmente:

```sql
DELETE FROM app_sessions WHERE expires_at < NOW() - INTERVAL '30 days'
   OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '30 days');
DELETE FROM login_attempts
 WHERE window_started_at < NOW() - INTERVAL '1 hour'
   AND (blocked_until IS NULL OR blocked_until < NOW());
```

Auditoria é append-only por gatilho: não há rota de exclusão. Se for necessário arquivar, crie uma tabela
de arquivo e copie (sem apagar a original) em uma migração documentada.

## Checklist de implantação na Vercel

1. Importar o repositório (Root Directory na raiz, Framework Preset *Other*).
2. Confirmar `package.json` com `"engines": { "node": ">=22" }` e `npm run build` como comando de build.
3. Cadastrar variáveis: `DATABASE_URL` (pooled), `IP_HASH_SALT`, `SESSION_TTL_HOURS` (opcional),
   `TRUSTED_PROXY_HEADERS=true`. **Não** cadastrar `ALLOW_SEED`, `SEED_*`, `TEST_DATABASE_*`,
   `MIGRATION_DATABASE_URL` nem `PORT`.
4. Deploy de **preview** primeiro; conferir `/api/v1/health` (`database: "connected"` e `configuracao: "ok"`).
5. Aplicar migrações com a conexão direta do Neon (`MIGRATION_DATABASE_URL` na sessão local do terminal).
6. Criar o primeiro administrador com `CONFIRMAR_CRIACAO_ADMIN=sim ... npm run db:criar-admin`.
7. Testar login, cadastro de peça e gravação de configuração no preview.
8. Promover para produção.
9. Confirmar os cabeçalhos de segurança (`curl -I` deve mostrar CSP, HSTS, X-Frame-Options).

## Diagnóstico

- `503 not_configured`: `DATABASE_URL` ausente no ambiente.
- `503 unavailable`: banco não respondeu. Verifique o Neon (limites, suspensão por inatividade, IP).
- `503` com `configuracao: "incompleta"`: `IP_HASH_SALT` ausente em produção.
- `401 NAO_AUTENTICADO`: sessão expirada, revogada ou usuário/vínculo inativo.
- `409 REVISAO_DESATUALIZADA`: outra pessoa alterou os dados; recarregue.
- Logs da Vercel: o `X-Request-Id` da resposta de erro localiza a linha correspondente no log.
- Logs de erro registram apenas tipo do erro, status, código e rota, sem parâmetros nem SQL.
