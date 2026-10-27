-- Migração 002: autenticação segura, permissões por módulo, limite de tentativas,
-- controle de concorrência do estado operacional e auditoria imutável.
--
-- Projetada para ser executada em:
--   * banco novo (sem usuários) -> nenhuma linha é alterada;
--   * banco que já possui usuários do esquema 001 -> o login de cada usuário é
--     derivado do e-mail (parte antes do @), normalizado. Se algum login resultante
--     for inválido ou repetido, a migração para com erro e NÃO altera nada
--     (a migração roda em transação; ver scripts/migrate.js);
--   * execução repetida (idempotente): colunas, índices, restrições e gatilhos
--     usam IF NOT EXISTS / verificação prévia.
--
-- Esta migração não deve ser editada após ser aplicada em um ambiente compartilhado;
-- alterações futuras devem ser feitas em novas migrações.

-- Usuários: login é o identificador de acesso (preserva o acesso "admin" da demonstração).
ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS login TEXT,
  ADD COLUMN IF NOT EXISTS cargo TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Backfill conservador: só preenche quem ainda não tem login.
UPDATE app_users
   SET login = regexp_replace(lower(split_part(COALESCE(email, name), '@', 1)), '[^a-z0-9._-]', '', 'g')
 WHERE login IS NULL;

-- Validação antes de tornar a coluna obrigatória: falha antes de qualquer restrição nova.
DO $$
DECLARE
  problemas TEXT;
BEGIN
  WITH invalidos AS (
    SELECT id, login FROM app_users
     WHERE login IS NULL
        OR login !~ '^[a-z0-9._-]{3,20}$'
        OR login IN (SELECT login FROM app_users GROUP BY login HAVING COUNT(*) > 1)
  )
  SELECT string_agg(id::text, ', ') INTO problemas FROM invalidos;

  IF problemas IS NOT NULL THEN
    RAISE EXCEPTION 'Migração 002 interrompida: logins inválidos ou repetidos após a normalização (ids: %). Ajuste esses usuários e aplique novamente.', problemas;
  END IF;
END
$$;

ALTER TABLE app_users ALTER COLUMN login SET NOT NULL;
ALTER TABLE app_users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_email_key;

CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_unique_idx
  ON app_users (lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS app_users_login_unique_idx ON app_users (login);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_users_login_format_chk') THEN
    ALTER TABLE app_users
      ADD CONSTRAINT app_users_login_format_chk CHECK (login ~ '^[a-z0-9._-]{3,20}$');
  END IF;
END
$$;

-- Vínculo usuário-empresa: permissões por módulo (lista fechada, validada no banco).
ALTER TABLE company_memberships
  ADD COLUMN IF NOT EXISTS permissions TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_memberships_permissions_chk') THEN
    ALTER TABLE company_memberships
      ADD CONSTRAINT company_memberships_permissions_chk CHECK (
        permissions <@ ARRAY['admin', 'almoxarifado', 'veiculos', 'manutencao', 'combustivel', 'relatorios']::TEXT[]
      );
  END IF;
END
$$;

-- Sessões: somente o hash do token, empresa ativa e metadados minimizados.
ALTER TABLE app_sessions
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS ip_hash TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

CREATE INDEX IF NOT EXISTS app_sessions_company_idx ON app_sessions (company_id);
-- Índice para a limpeza periódica de sessões expiradas.
CREATE INDEX IF NOT EXISTS app_sessions_expires_at_idx ON app_sessions (expires_at);

-- Limite de tentativas de login persistido no banco (funções serverless não compartilham memória).
-- As chaves são hashes com salt; nunca o IP ou o login em texto.
CREATE TABLE IF NOT EXISTS login_attempts (
  key TEXT PRIMARY KEY,
  failures INTEGER NOT NULL DEFAULT 0 CHECK (failures >= 0),
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked_until TIMESTAMPTZ
);

-- Estado operacional: revisão incremental para detectar atualização concorrente.
ALTER TABLE fleet_workspace_state
  ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES app_users(id) ON DELETE SET NULL;

-- Auditoria: campos de entidade e imutabilidade garantida pelo banco.
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS entity TEXT,
  ADD COLUMN IF NOT EXISTS entity_id TEXT,
  ADD COLUMN IF NOT EXISTS ip_hash TEXT;

CREATE OR REPLACE FUNCTION audit_logs_bloquear_alteracao()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs é append-only: alteração e exclusão não são permitidas';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_nao_altera ON audit_logs;
CREATE TRIGGER audit_logs_nao_altera
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_bloquear_alteracao();
