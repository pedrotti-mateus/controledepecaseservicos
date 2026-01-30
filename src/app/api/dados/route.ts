import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dataInicio = searchParams.get("dataInicio");
  const dataFim = searchParams.get("dataFim");
  const consultores = searchParams.get("consultores"); // comma separated

  const supabase = createServiceClient();

  let query = supabase
    .from("pecas_servicos")
    .select(
      "data, filial, peca_ou_servico, balcao_ou_oficina, tipo_midia, consultor, condicao_pagamento, venda_devolucao, cliente, faturamento, impostos, venda_liquida, custo_total, lucro_rs, margem_pct"
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

  // Order by id for deterministic pagination (without order, Supabase/PostgREST
  // can return rows in different orders across range requests, skipping data)
  query = query.order("id");

  // Supabase has a default limit of 1000 rows, we need all data
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
