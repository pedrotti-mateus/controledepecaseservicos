import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

interface DataRow {
  referencia: string | null;
  peca_servico_nome: string | null;
  lucro_rs: number;
  faturamento: number;
  venda_liquida: number;
  custo_total: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ano = parseInt(searchParams.get("ano") || "0");
    const mes = parseInt(searchParams.get("mes") || "0");

    if (!ano || !mes) {
      return NextResponse.json({ error: "Parametros ano e mes sao obrigatorios" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const dataInicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
    const lastDay = new Date(ano, mes, 0).getDate();
    const dataFim = `${ano}-${String(mes).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    // Fetch all data for the month with referencia field
    const allData: DataRow[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("pecas_servicos")
        .select("referencia, peca_servico_nome, lucro_rs, faturamento, venda_liquida, custo_total")
        .gte("data", dataInicio)
        .lte("data", dataFim)
        .order("id")
        .range(from, from + pageSize - 1);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      if (data && data.length > 0) {
        allData.push(...(data as DataRow[]));
        from += pageSize;
        if (data.length < pageSize) hasMore = false;
      } else {
        hasMore = false;
      }
    }

    // Filter items starting with "C.F.Q" or "C.G" by peca_servico_nome
    const itensChapa = allData.filter((row) => {
      const nome = (row.peca_servico_nome || "").toUpperCase().trim();
      return nome.startsWith("C.F.Q") || nome.startsWith("C.G");
    });

    // Group by peca_servico_nome for detail
    const refMap = new Map<string, { nome: string; lucro: number; faturamento: number }>();
    let lucroTotal = 0;
    let faturamentoTotal = 0;

    for (const row of itensChapa) {
      const nome = row.peca_servico_nome || "SEM NOME";
      const existing = refMap.get(nome);
      const lucro = row.lucro_rs || 0;
      const fat = row.faturamento || 0;

      if (existing) {
        existing.lucro += lucro;
        existing.faturamento += fat;
      } else {
        refMap.set(nome, { nome, lucro, faturamento: fat });
      }

      lucroTotal += lucro;
      faturamentoTotal += fat;
    }

    const percentual = 0.06;
    const variavel = Math.round(Math.max(0, lucroTotal * percentual) * 100) / 100;

    // Build detail rows sorted by faturamento desc
    const itens = Array.from(refMap.entries())
      .map(([ref, v]) => ({
        referencia: ref,
        nome: v.nome,
        faturamento: Math.round(v.faturamento * 100) / 100,
        lucro: Math.round(v.lucro * 100) / 100,
      }))
      .sort((a, b) => b.faturamento - a.faturamento);

    return NextResponse.json({
      mecanico: "MARCOS FERNANDO DIAS",
      lucro_total: Math.round(lucroTotal * 100) / 100,
      faturamento_total: Math.round(faturamentoTotal * 100) / 100,
      percentual: percentual * 100,
      variavel,
      qtd_itens: itensChapa.length,
      itens,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
