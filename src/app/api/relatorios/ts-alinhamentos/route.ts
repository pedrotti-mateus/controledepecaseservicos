import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

const MECANICOS_TS = [
  "THIAGO BERNARDES DOS SANTOS",
  "MARCOS ALEXANDRE BERNARDES DOS SANTOS",
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ano = parseInt(searchParams.get("ano") || "0");
    const mes = parseInt(searchParams.get("mes") || "0");

    if (!ano || !mes) {
      return NextResponse.json({ error: "Parametros ano e mes sao obrigatorios" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("comissoes_mecanicos")
      .select("mecanico, valor_servicos, comissao_total, percentual_comissao, num_ordens")
      .eq("ano", ano)
      .eq("mes", mes)
      .in("mecanico", MECANICOS_TS)
      .order("mecanico");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch detail records (OS numbers + clients)
    let detalhes: Array<{
      mecanico: string;
      numero_os: string;
      cliente: string;
      valor_servico: number;
      comissao: number;
    }> = [];

    try {
      const { data: det } = await supabase
        .from("comissoes_mecanicos_detalhe")
        .select("mecanico, numero_os, cliente, valor_servico, comissao")
        .eq("ano", ano)
        .eq("mes", mes)
        .in("mecanico", MECANICOS_TS)
        .order("mecanico")
        .order("numero_os");

      detalhes = det || [];
    } catch {
      // Table might not exist yet
    }

    return NextResponse.json({ data: data || [], detalhes });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
