-- RPC function to fetch all pecas_servicos in a single call (no pagination needed)
CREATE OR REPLACE FUNCTION get_pecas_servicos(
  p_data_inicio DATE,
  p_data_fim DATE,
  p_consultores TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  data DATE,
  filial TEXT,
  peca_ou_servico TEXT,
  balcao_ou_oficina TEXT,
  tipo_midia TEXT,
  consultor TEXT,
  condicao_pagamento TEXT,
  venda_devolucao TEXT,
  cliente TEXT,
  faturamento NUMERIC,
  impostos NUMERIC,
  venda_liquida NUMERIC,
  custo_total NUMERIC,
  lucro_rs NUMERIC
)
LANGUAGE sql STABLE
AS $$
  SELECT
    ps.data, ps.filial, ps.peca_ou_servico, ps.balcao_ou_oficina,
    ps.tipo_midia, ps.consultor, ps.condicao_pagamento, ps.venda_devolucao,
    ps.cliente, ps.faturamento, ps.impostos, ps.venda_liquida,
    ps.custo_total, ps.lucro_rs
  FROM pecas_servicos ps
  WHERE ps.data >= p_data_inicio
    AND ps.data <= p_data_fim
    AND (p_consultores IS NULL OR ps.consultor = ANY(p_consultores))
  ORDER BY ps.id;
$$;
