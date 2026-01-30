import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dataInicio = searchParams.get("dataInicio");
  const dataFim = searchParams.get("dataFim");
  const consultores = searchParams.get("consultores"); // comma separated

  const supabase = createServiceClient();

  // Try RPC first (single HTTP call, no pagination needed)
  const rpcParams: Record<string, unknown> = {
    p_data_inicio: dataInicio || "1900-01-01",
    p_data_fim: dataFim || "2099-12-31",
    p_consultores: consultores ? consultores.split(",").map((c) => c.trim()) : null,
  };

  const { data: rpcData, error: rpcError } = await supabase.rpc("get_pecas_servicos", rpcParams);

  if (!rpcError && rpcData) {
    return NextResponse.json({ data: rpcData, total: rpcData.length });
  }

  // Fallback: paginated query (if RPC function not yet created)
  let query = supabase
    .from("pecas_servicos")
    .select(
      "data, filial, peca_ou_servico, balcao_ou_oficina, tipo_midia, consultor, condicao_pagamento, venda_devolucao, cliente, faturamento, impostos, venda_liquida, custo_total, lucro_rs"
    );

  if (dataInicio) {
    query = query.gte("data", dataInicio);
  }
  if (dataFim) {
    query = query.lte("data", dataFim);
  }
  if (consultores) {
    const consultoresList = consultores.split(",").map((c) => c.trim());
    query = query.in("consultor", consultoresList);
  }

  query = query.order("id");

  const allData: Record<string, unknown>[] = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (data && data.length > 0) {
      allData.push(...data);
      from += pageSize;
      if (data.length < pageSize) hasMore = false;
    } else {
      hasMore = false;
    }
  }

  return NextResponse.json({ data: allData, total: allData.length });
}
