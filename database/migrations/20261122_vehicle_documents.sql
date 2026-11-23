"use strict";

-- Armazenamento persistente dos documentos PDF dos veículos (CRLV).
-- A chave única corresponde ao ON CONFLICT usado pela API: um CRLV por veículo/empresa.
CREATE TABLE IF NOT EXISTS vehicle_documents (
  company_id UUID NOT NULL,
  veiculo_id TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'CRLV' CHECK (tipo = 'CRLV'),
  nome_arquivo TEXT NOT NULL CHECK (char_length(nome_arquivo) BETWEEN 1 AND 120),
  tamanho_bytes INTEGER NOT NULL CHECK (tamanho_bytes BETWEEN 1 AND 3145728),
  conteudo BYTEA NOT NULL,
  enviado_por UUID,
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vehicle_documents_company_vehicle_type_pk
    PRIMARY KEY (company_id, veiculo_id, tipo)
);

CREATE INDEX IF NOT EXISTS vehicle_documents_company_sent_idx
  ON vehicle_documents (company_id, enviado_em DESC);
