-- Migração 005: reautenticação de administrador para ajustes de estoque.
-- reauth_ate guarda até quando a senha do administrador foi confirmada nesta sessão.
-- Ajustes de estoque só são gravados enquanto essa janela estiver aberta.

ALTER TABLE app_sessions
  ADD COLUMN IF NOT EXISTS reauth_ate TIMESTAMPTZ;
