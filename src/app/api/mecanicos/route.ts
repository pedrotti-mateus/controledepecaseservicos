import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ano = searchParams.get("ano");
  const mes = searchParams.get("mes");

  if (!ano) {
    return NextResponse.json(
      { error: "Parametro 'ano' obrigatorio" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  let query = supabase
    .from("comissoes_mecanicos")
    .select("*")
    .eq("ano", parseInt(ano, 10))
    .order("valor_servicos", { ascending: false });

  if (mes) {
    query = query.eq("mes", parseInt(mes, 10));
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data || [] });
}
