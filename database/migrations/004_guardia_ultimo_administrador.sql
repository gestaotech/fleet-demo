-- Migração 004: serializa edições de usuários por empresa e protege o último administrador ativo.
-- A função é chamada por uma única instrução SQL, compatível com o driver HTTP do Neon.
-- O lock da linha da empresa serializa a validação e a gravação; os dados operacionais não são recriados.

CREATE OR REPLACE FUNCTION atualizar_usuario_com_guardia(
  p_user_id UUID,
  p_company_id UUID,
  p_name TEXT,
  p_cargo TEXT,
  p_active BOOLEAN,
  p_password_hash TEXT,
  p_permissions TEXT[],
  p_revoke_sessions BOOLEAN,
  p_actor_user_id UUID,
  p_metadata JSONB,
  p_ip_hash TEXT,
  p_user_agent TEXT
)
RETURNS TABLE(updated_user_id UUID, error_code TEXT)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_ativo_usuario BOOLEAN;
  v_ativo_vinculo BOOLEAN;
  v_permissoes TEXT[];
  v_era_admin_ativo BOOLEAN;
  v_outros_admins INTEGER;
BEGIN
  -- Todas as edições de usuários da mesma empresa passam por este lock.
  PERFORM 1 FROM companies WHERE id = p_company_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, 'USUARIO_NAO_ENCONTRADO'::TEXT;
    RETURN;
  END IF;

  SELECT u.active, m.active, m.permissions
    INTO v_ativo_usuario, v_ativo_vinculo, v_permissoes
    FROM company_memberships m
    JOIN app_users u ON u.id = m.user_id
   WHERE m.user_id = p_user_id AND m.company_id = p_company_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, 'USUARIO_NAO_ENCONTRADO'::TEXT;
    RETURN;
  END IF;

  v_era_admin_ativo := v_ativo_usuario AND v_ativo_vinculo AND ('admin' = ANY(v_permissoes));
  IF v_era_admin_ativo AND NOT (p_active AND ('admin' = ANY(p_permissions))) THEN
    SELECT COUNT(*)::INTEGER INTO v_outros_admins
      FROM company_memberships m
      JOIN app_users u ON u.id = m.user_id
     WHERE m.company_id = p_company_id
       AND m.user_id <> p_user_id
       AND m.active = TRUE AND u.active = TRUE
       AND 'admin' = ANY(m.permissions);

    IF v_outros_admins = 0 THEN
      RETURN QUERY SELECT NULL::UUID, 'ULTIMO_ADMINISTRADOR'::TEXT;
      RETURN;
    END IF;
  END IF;

  UPDATE app_users
     SET name = p_name,
         cargo = p_cargo,
         active = p_active,
         password_hash = COALESCE(p_password_hash, password_hash),
         updated_at = NOW()
   WHERE id = p_user_id;

  UPDATE company_memberships
     SET permissions = p_permissions,
         active = p_active,
         role = CASE WHEN 'admin' = ANY(p_permissions) THEN 'ADMIN' ELSE 'MEMBER' END,
         updated_at = NOW()
   WHERE user_id = p_user_id AND company_id = p_company_id;

  IF p_revoke_sessions THEN
    UPDATE app_sessions
       SET revoked_at = NOW()
     WHERE user_id = p_user_id AND revoked_at IS NULL;
  END IF;

  INSERT INTO audit_logs
    (company_id, actor_user_id, action, entity, entity_id, result, metadata, ip_hash, user_agent)
  VALUES
    (p_company_id, p_actor_user_id, 'USUARIO_ATUALIZADO', 'app_users',
     p_user_id::TEXT, 'SUCCESS', p_metadata, p_ip_hash, p_user_agent);

  RETURN QUERY SELECT p_user_id, NULL::TEXT;
END;
$$;
