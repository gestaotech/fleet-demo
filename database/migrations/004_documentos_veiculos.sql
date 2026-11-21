-- Migração 004: documento CRLV dos veículos (PDF armazenado no banco).
-- Um documento por veículo e tipo: um novo envio substitui o anterior.
-- O estado operacional (fleet_workspace_state) não guarda o arquivo, porque ele é gravado
-- inteiro a cada alteração e tem limite de tamanho por requisição.

CREATE TABLE IF NOT EXISTS vehicle_documents (
  company_id UUID NOT NULL REFERENCES companies(id),
  veiculo_id TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'CRLV' CHECK (tipo IN ('CRLV')),
  nome_arquivo TEXT NOT NULL,
  tamanho_bytes INTEGER NOT NULL CHECK (tamanho_bytes > 0),
  conteudo BYTEA NOT NULL,
  enviado_por UUID REFERENCES app_users(id),
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (company_id, veiculo_id, tipo)
);
