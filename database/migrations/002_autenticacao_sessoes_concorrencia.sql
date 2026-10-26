-- Migração 002: autenticação segura, permissões por módulo, limite de tentativas,
-- controle de concorrência do estado operacional e auditoria imutável.
--
-- Não altera a 001 (que pode já ter sido aplicada). Toda alteração é feita aqui.
-- Não há conversão automática de dados: a migração recusa rodar se app_users já
-- tiver registros, porque o identificador de acesso (login) precisaria de decisão
-- explícita. Em banco novo (recomendado para a demonstração) ela roda sem perda.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM app_users) THEN
    RAISE EXCEPTION 'Migração 002 exige app_users vazia. Trate os usuários existentes manualmente antes de aplicar.';
  END IF;
END
$$;

-- Usuários: login é o identificador de acesso (preserva o acesso "admin" da demonstração).
-- O e-mail deixa de ser obrigatório.
ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS login TEXT NOT NULL,
  ADD COLUMN IF NOT EXISTS cargo TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

ALTER TABLE app_users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_unique_idx
  ON app_users (lower(email)) WHERE email IS NOT NULL;

ALTER TABLE app_users
  ADD CONSTRAINT app_users_login_format_chk CHECK (login ~ '^[a-z0-9._-]{3,20}$');

CREATE UNIQUE INDEX IF NOT EXISTS app_users_login_unique_idx ON app_users (login);

-- Vínculo usuário-empresa: permissões por módulo (lista fechada e validada no banco).
ALTER TABLE company_memberships
  ADD COLUMN IF NOT EXISTS permissions TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE company_memberships
  ADD CONSTRAINT company_memberships_permissions_chk CHECK (
    permissions <@ ARRAY['admin', 'almoxarifado', 'veiculos', 'manutencao', 'combustivel', 'relatorios']::TEXT[]
  );

-- Sessões: guardam somente o hash do token, a empresa ativa e metadados minimizados
-- (IP em hash, user agent truncado pela aplicação).
ALTER TABLE app_sessions
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS ip_hash TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

CREATE INDEX IF NOT EXISTS app_sessions_company_idx ON app_sessions (company_id);

-- Limite de tentativas de login persistido no banco. Funções serverless não compartilham
-- memória entre instâncias; por isso o contador fica no PostgreSQL.
-- A chave é um hash (IP ou login normalizado), nunca o valor em texto.
CREATE TABLE IF NOT EXISTS login_attempts (
  key TEXT PRIMARY KEY,
  failures INTEGER NOT NULL DEFAULT 0 CHECK (failures >= 0),
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked_until TIMESTAMPTZ
);

-- Estado operacional: revisão incremental para detectar atualização concorrente.
-- Cada gravação só é aceita se a revisão do cliente ainda for a atual.
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
