CREATE TABLE upload_logs (
  id BIGSERIAL PRIMARY KEY,
  nome_arquivo TEXT NOT NULL,
  tamanho_bytes BIGINT NOT NULL,
  total_registros INTEGER NOT NULL,
  registros_inseridos INTEGER NOT NULL,
  storage_path TEXT,
  status TEXT NOT NULL DEFAULT 'sucesso',
  erros TEXT[],
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);
