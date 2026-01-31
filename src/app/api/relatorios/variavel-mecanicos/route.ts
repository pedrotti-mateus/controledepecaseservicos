import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ano = parseInt(searchParams.get("ano") || "0");
    const mes = parseInt(searchParams.get("mes") || "0");

    if (!ano || !mes) {
      return NextResponse.json({ error: "Parametros ano e mes sao obrigatorios" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Get commissioned mechanics with salary
    const { data: cadastro, error: errCad } = await supabase
      .from("cadastro_mecanicos")
      .select("mecanico, filial, salario_fixo")
      .eq("comissionado", true)
      .order("mecanico");

    if (errCad) {
      return NextResponse.json({ error: errCad.message }, { status: 500 });
    }

    // Get commissions for the month
    const { data: comissoes, error: errCom } = await supabase
      .from("comissoes_mecanicos")
      .select("mecanico, comissao_total")
      .eq("ano", ano)
      .eq("mes", mes);

    if (errCom) {
      return NextResponse.json({ error: errCom.message }, { status: 500 });
    }

    // Build commission lookup
    const comissaoMap = new Map<string, number>();
    for (const c of comissoes || []) {
      comissaoMap.set(c.mecanico, c.comissao_total || 0);
    }

    // Calculate variable per mechanic
    const resultado: Array<{
      mecanico: string;
      filial: string;
      comissao_total: number;
      salario_fixo: number;
      variavel: number;
      regra: "comissao" | "chapa";
    }> = (cadastro || []).map((mec) => {
      const comissao = comissaoMap.get(mec.mecanico) || 0;
      const salario = mec.salario_fixo || 0;
      const variavel = Math.max(0, comissao - salario);
      return {
        mecanico: mec.mecanico,
        filial: mec.filial,
        comissao_total: Math.round(comissao * 100) / 100,
        salario_fixo: Math.round(salario * 100) / 100,
        variavel: Math.round(variavel * 100) / 100,
        regra: "comissao" as const,
      };
    });

    // --- MARCOS FERNANDO DIAS: 6% lucro chapa dobrada (C.F.Q / C.G) ---
    const dataInicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
    const lastDay = new Date(ano, mes, 0).getDate();
    const dataFim = `${ano}-${String(mes).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    let allChapa: Array<{ peca_servico_nome: string | null; lucro_rs: number }> = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("pecas_servicos")
        .select("peca_servico_nome, lucro_rs")
        .gte("data", dataInicio)
        .lte("data", dataFim)
        .order("id")
        .range(from, from + pageSize - 1);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      if (data && data.length > 0) {
        allChapa.push(...data);
        from += pageSize;
        if (data.length < pageSize) hasMore = false;
      } else {
        hasMore = false;
      }
    }

    const itensChapa = allChapa.filter((row) => {
      const nome = (row.peca_servico_nome || "").toUpperCase().trim();
      return nome.startsWith("C.F.Q") || nome.startsWith("C.G");
    });

    let lucroChapa = 0;
    for (const row of itensChapa) {
      lucroChapa += row.lucro_rs || 0;
    }

    const percentualChapa = 0.06;
    const variavelChapa = Math.round(Math.max(0, lucroChapa * percentualChapa) * 100) / 100;

    resultado.push({
      mecanico: "MARCOS FERNANDO DIAS",
      filial: "-",
      comissao_total: Math.round(lucroChapa * 100) / 100,
      salario_fixo: 0,
      variavel: variavelChapa,
      regra: "chapa",
    });

    return NextResponse.json({ data: resultado });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
