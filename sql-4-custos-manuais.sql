-- Tabela para custos manuais da oficina (por filial, ano, mes)
CREATE TABLE IF NOT EXISTS custos_manuais_oficina (
  id BIGSERIAL PRIMARY KEY,
  filial TEXT NOT NULL,
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL, -- 1 a 12
  custo_folha NUMERIC(15,2) DEFAULT 0,
  horas_extras NUMERIC(15,2) DEFAULT 0,
  custo_terceiros NUMERIC(15,2) DEFAULT 0,
  custo_variaveis NUMERIC(15,2) DEFAULT 0,
  consumiveis NUMERIC(15,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (filial, ano, mes)
);

ALTER TABLE custos_manuais_oficina ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON custos_manuais_oficina FOR ALL USING (true) WITH CHECK (true);
