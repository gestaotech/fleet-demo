BEGIN;

-- Garante integridade referencial adicional e trilha imutavel.
-- A auditoria nunca pode ser alterada ou apagada por aplicacao comum.
-- Permissao concedida apenas ao banco em contextos administrativos.

CREATE OR REPLACE FUNCTION auditlog_prevent_change()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog e imutavel: nao e permitido alterar ou excluir registros de auditoria';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auditlog_block_update
BEFORE UPDATE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION auditlog_prevent_change();

CREATE TRIGGER auditlog_block_delete
BEFORE DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION auditlog_prevent_change();

-- Impede login de usuarios inativos em qualquer contexto (defesa em profundidade).
CREATE OR REPLACE FUNCTION prevent_inactive_user_login_check()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "User" WHERE id = NEW."userId" AND active = false) THEN
    RAISE EXCEPTION 'Usuario inativo nao pode possuir sessoes ativas';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER session_block_inactive_user
BEFORE INSERT OR UPDATE ON "Session"
FOR EACH ROW EXECUTE FUNCTION prevent_inactive_user_login_check();

-- Garante que membership inativo nao possa ter permissoes explicitamente usadas
-- (defesa em profundidade; autorizacao tambem filtra por membership.active).
CREATE OR REPLACE FUNCTION prevent_permission_for_inactive_membership()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "CompanyMembership" WHERE id = NEW."membershipId" AND active = false) THEN
    RAISE EXCEPTION 'Nao e permitido conceder permissao a vinculo inativo';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER membershipperm_block_inactive_membership
BEFORE INSERT OR UPDATE ON "MembershipPermission"
FOR EACH ROW EXECUTE FUNCTION prevent_permission_for_inactive_membership();

COMMIT;
