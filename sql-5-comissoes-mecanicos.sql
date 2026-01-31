-- Tabela para comissoes dos mecanicos (resumo por mecanico por mes)
CREATE TABLE IF NOT EXISTS comissoes_mecanicos (
  id BIGSERIAL PRIMARY KEY,
  mecanico TEXT NOT NULL,
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL,
  valor_servicos NUMERIC(15,2) NOT NULL DEFAULT 0,
  comissao_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  percentual_comissao NUMERIC(5,2),
  num_ordens INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (mecanico, ano, mes)
);

CREATE INDEX IF NOT EXISTS idx_comissoes_mecanicos_ano_mes
  ON comissoes_mecanicos(ano, mes);
CREATE INDEX IF NOT EXISTS idx_comissoes_mecanicos_mecanico
  ON comissoes_mecanicos(mecanico);

ALTER TABLE comissoes_mecanicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access comissoes_mecanicos"
  ON comissoes_mecanicos FOR ALL USING (true) WITH CHECK (true);
