import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = createServiceClient();

    // Get all registered mechanics
    const { data: cadastrados, error: errCad } = await supabase
      .from("cadastro_mecanicos")
      .select("*")
      .order("mecanico");

    if (errCad) {
      return NextResponse.json({ error: errCad.message }, { status: 500 });
    }

    // Get distinct mechanic names from comissoes_mecanicos
    const { data: comissoes, error: errCom } = await supabase
      .from("comissoes_mecanicos")
      .select("mecanico");

    if (errCom) {
      return NextResponse.json({ error: errCom.message }, { status: 500 });
    }

    const cadastradosSet = new Set((cadastrados || []).map((c) => c.mecanico));
    const nomesComissoes = new Set((comissoes || []).map((c) => c.mecanico));
    const naoCadastrados = Array.from(nomesComissoes)
      .filter((n) => !cadastradosSet.has(n))
      .sort();

    // Get distinct filiais from pecas_servicos
    const { data: filiaisData, error: errFil } = await supabase
      .from("pecas_servicos")
      .select("filial");

    if (errFil) {
      return NextResponse.json({ error: errFil.message }, { status: 500 });
    }

    const filiais = Array.from(new Set((filiaisData || []).map((f) => f.filial).filter(Boolean))).sort();

    return NextResponse.json({
      cadastrados: cadastrados || [],
      nao_cadastrados: naoCadastrados,
      filiais,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mecanico, filial, salario_fixo, comissionado } = body;

    if (!mecanico || typeof mecanico !== "string") {
      return NextResponse.json({ error: "Nome do mecanico e obrigatorio" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("cadastro_mecanicos")
      .upsert(
        {
          mecanico: mecanico.trim(),
          filial: filial || null,
          salario_fixo: salario_fixo || 0,
          comissionado: comissionado || false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "mecanico" }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
