import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ano = searchParams.get("ano");

  if (!ano) {
    return NextResponse.json({ error: "Parametro 'ano' obrigatorio" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("custos_manuais_oficina")
    .select("*")
    .eq("ano", parseInt(ano))
    .order("filial")
    .order("mes");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ custos: data || [] });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filial, ano, mes, custo_folha, horas_extras, custo_terceiros, custo_variaveis, consumiveis } = body;

    if (!filial || !ano || !mes) {
      return NextResponse.json({ error: "filial, ano e mes sao obrigatorios" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("custos_manuais_oficina")
      .upsert(
        {
          filial,
          ano,
          mes,
          custo_folha: custo_folha || 0,
          horas_extras: horas_extras || 0,
          custo_terceiros: custo_terceiros || 0,
          custo_variaveis: custo_variaveis || 0,
          consumiveis: consumiveis || 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "filial,ano,mes" }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, custo: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
