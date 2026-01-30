-- Schema para a tabela de peças e serviços
CREATE TABLE IF NOT EXISTS pecas_servicos (
  id BIGSERIAL PRIMARY KEY,
  qtd_doc INTEGER,
  nota TEXT,
  os_vb TEXT,
  referencia TEXT,
  cod_item INTEGER,
  peca_servico_nome TEXT,
  pessoa_tipo TEXT,
  codigo_cliente INTEGER,
  cliente TEXT,
  data DATE,
  serie TEXT,
  filial TEXT,
  peca_ou_servico TEXT,
  venda_devolucao TEXT,
  tipo_preco TEXT,
  condicao_pagamento TEXT,
  balcao_ou_oficina TEXT,
  tipo_os TEXT,
  consultor TEXT,
  conveniado TEXT,
  tipo_midia TEXT,
  cfop INTEGER,
  uf_cliente TEXT,
  cidade_cliente TEXT,
  bairro_cliente TEXT,
  email_cliente TEXT,
  telefone_cliente TEXT,
  produto_servico TEXT,
  modalidade_venda TEXT,
  familia_modelo_veiculo TEXT,
  marca_produto TEXT,
  categoria_peca_servico TEXT,
  modelo TEXT,
  venda_bruta_1 NUMERIC(15,2),
  venda_bruta_2 NUMERIC(15,2),
  faturamento NUMERIC(15,2),
  impostos NUMERIC(15,2),
  venda_liquida NUMERIC(15,2),
  icms_iss NUMERIC(15,2),
  pis NUMERIC(15,2),
  cofins NUMERIC(15,2),
  qtd_item NUMERIC(15,2),
  bandeira_pedido TEXT,
  custo_total NUMERIC(15,2),
  lucro_rs NUMERIC(15,2),
  margem_pct NUMERIC(15,4),
  valor_contabil NUMERIC(15,2),
  markup_pct NUMERIC(15,4),
  ipi NUMERIC(15,2),
  icms_st NUMERIC(15,2),
  frete NUMERIC(15,2),
  seguro NUMERIC(15,2),
  despesas NUMERIC(15,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices para performance nas consultas
CREATE INDEX IF NOT EXISTS idx_pecas_servicos_data ON pecas_servicos(data);
CREATE INDEX IF NOT EXISTS idx_pecas_servicos_filial ON pecas_servicos(filial);
CREATE INDEX IF NOT EXISTS idx_pecas_servicos_peca_servico ON pecas_servicos(peca_ou_servico);
CREATE INDEX IF NOT EXISTS idx_pecas_servicos_balcao_oficina ON pecas_servicos(balcao_ou_oficina);
CREATE INDEX IF NOT EXISTS idx_pecas_servicos_tipo_midia ON pecas_servicos(tipo_midia);
CREATE INDEX IF NOT EXISTS idx_pecas_servicos_consultor ON pecas_servicos(consultor);
CREATE INDEX IF NOT EXISTS idx_pecas_servicos_condicao_pagamento ON pecas_servicos(condicao_pagamento);
CREATE INDEX IF NOT EXISTS idx_pecas_servicos_venda_devolucao ON pecas_servicos(venda_devolucao);

-- Enable RLS but allow all access for now (the app uses service_role key for writes)
ALTER TABLE pecas_servicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON pecas_servicos FOR ALL USING (true) WITH CHECK (true);

-- Log de uploads de arquivos
CREATE TABLE IF NOT EXISTS upload_logs (
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

ALTER TABLE upload_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access upload_logs" ON upload_logs FOR ALL USING (true) WITH CHECK (true);

-- Bucket para armazenar os arquivos Excel enviados
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', false)
ON CONFLICT (id) DO NOTHING;
