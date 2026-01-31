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
    const resultado = (cadastro || []).map((mec) => {
      const comissao = comissaoMap.get(mec.mecanico) || 0;
      const salario = mec.salario_fixo || 0;
      const variavel = Math.max(0, comissao - salario);
      return {
        mecanico: mec.mecanico,
        filial: mec.filial,
        comissao_total: Math.round(comissao * 100) / 100,
        salario_fixo: Math.round(salario * 100) / 100,
        variavel: Math.round(variavel * 100) / 100,
      };
    });

    return NextResponse.json({ data: resultado });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
