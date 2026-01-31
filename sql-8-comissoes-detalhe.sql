-- Table for individual service order details from mechanic commission PDFs
CREATE TABLE IF NOT EXISTS comissoes_mecanicos_detalhe (
  id BIGSERIAL PRIMARY KEY,
  mecanico TEXT NOT NULL,
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL,
  numero_os TEXT NOT NULL,
  cliente TEXT,
  valor_servico NUMERIC(15,2) DEFAULT 0,
  comissao NUMERIC(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cmd_mecanico ON comissoes_mecanicos_detalhe (mecanico);
CREATE INDEX IF NOT EXISTS idx_cmd_ano_mes ON comissoes_mecanicos_detalhe (ano, mes);

ALTER TABLE comissoes_mecanicos_detalhe ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access comissoes_mecanicos_detalhe"
  ON comissoes_mecanicos_detalhe FOR ALL USING (true) WITH CHECK (true);
