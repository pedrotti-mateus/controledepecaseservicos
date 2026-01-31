-- Tabela de cadastro de mecanicos (salario fixo + flag comissionado)
CREATE TABLE IF NOT EXISTS cadastro_mecanicos (
  id BIGSERIAL PRIMARY KEY,
  mecanico TEXT NOT NULL UNIQUE,
  filial TEXT,
  salario_fixo NUMERIC(15,2) DEFAULT 0,
  comissionado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cadastro_mecanicos_mecanico ON cadastro_mecanicos (mecanico);
CREATE INDEX IF NOT EXISTS idx_cadastro_mecanicos_filial ON cadastro_mecanicos (filial);
CREATE INDEX IF NOT EXISTS idx_cadastro_mecanicos_comissionado ON cadastro_mecanicos (comissionado);

-- RLS
ALTER TABLE cadastro_mecanicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access cadastro_mecanicos"
  ON cadastro_mecanicos FOR ALL
  USING (true) WITH CHECK (true);
