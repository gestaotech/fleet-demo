-- Migração 003: coluna user_agent na auditoria.
-- A 002 foi aplicada sem esta coluna, que as rotas de auditoria já utilizam.
-- Mantida como migração nova (e não edição da 002) para preservar o histórico
-- de migrações aplicadas e seus checksums.

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS user_agent TEXT;
