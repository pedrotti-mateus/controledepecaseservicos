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

    // Get commissioned mechanics with filial assigned
    const { data: cadastro, error: errCad } = await supabase
      .from("cadastro_mecanicos")
      .select("mecanico, filial, salario_fixo")
      .eq("comissionado", true)
      .not("filial", "is", null);

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

    // Calculate variable cost per filial
    const porFilial = new Map<string, number>();
    for (const mec of cadastro || []) {
      const comissao = comissaoMap.get(mec.mecanico) || 0;
      const salario = mec.salario_fixo || 0;
      const delta = Math.max(0, comissao - salario);
      const filial = mec.filial!;
      porFilial.set(filial, (porFilial.get(filial) || 0) + delta);
    }

    const resultado = Array.from(porFilial.entries())
      .map(([filial, custo_variaveis]) => ({
        filial,
        custo_variaveis: Math.round(custo_variaveis * 100) / 100,
      }))
      .sort((a, b) => a.filial.localeCompare(b.filial));

    return NextResponse.json({ resultado });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
