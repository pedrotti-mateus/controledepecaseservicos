import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

interface DataRow {
  filial: string;
  peca_ou_servico: string;
  balcao_ou_oficina: string;
  tipo_midia: string;
  consultor: string;
  cliente: string | null;
  lucro_rs: number;
  custo_total: number;
}

interface CustoManual {
  filial: string;
  mes: number;
  custo_folha: number;
  horas_extras: number;
  custo_terceiros: number;
  custo_variaveis: number;
  consumiveis: number;
}

const CLIENTES_INTER = [
  "PEDROTTI IMPLEMENTOS RODOVIARIOS LTDA",
  "POSTO DE MOLAS PEDROTTI LTDA",
];

function excluir(row: DataRow): boolean {
  if ((row.filial || "").toUpperCase().includes("POSTO DE MOLAS")) return false;
  if (
    (row.filial || "").toUpperCase().includes("MAGALH") &&
    (row.peca_ou_servico || "").toUpperCase().includes("SERVI") &&
    CLIENTES_INTER.includes((row.cliente || "").toUpperCase().trim())
  ) return false;
  return true;
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

    // Build date range for the month
    const dataInicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
    const lastDay = new Date(ano, mes, 0).getDate();
    const dataFim = `${ano}-${String(mes).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    // Fetch all data for the month (paginated)
    let query = supabase
      .from("pecas_servicos")
      .select("filial, peca_ou_servico, balcao_ou_oficina, tipo_midia, consultor, cliente, lucro_rs, custo_total")
      .gte("data", dataInicio)
      .lte("data", dataFim)
      .order("id");

    const allData: DataRow[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await query.range(from, from + pageSize - 1);
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

    // Apply exclusion filters
    const rows = allData.filter(excluir);

    // Group lucro pecas per consultant
    const consultorMap = new Map<string, number>();
    let totalLucroPecas = 0;
    let lucroServicoOficina = 0;

    for (const row of rows) {
      const tipo = (row.peca_ou_servico || "").toUpperCase();

      // Lucro pecas per consultant
      if (tipo.includes("PE")) {
        const lucro = row.lucro_rs || 0;
        const consultor = row.consultor || "SEM CONSULTOR";
        consultorMap.set(consultor, (consultorMap.get(consultor) || 0) + lucro);
        totalLucroPecas += lucro;
      }

      // Lucro servico oficina (for encarregado)
      if (tipo.includes("SERVI") && (row.balcao_ou_oficina || "").toUpperCase().includes("OFICINA")) {
        lucroServicoOficina += row.lucro_rs || 0;
      }
    }

    // Fetch manual costs for the month (for encarregado adjustment)
    const { data: custosData } = await supabase
      .from("custos_manuais_oficina")
      .select("filial, mes, custo_folha, horas_extras, custo_terceiros, custo_variaveis, consumiveis")
      .eq("ano", ano)
      .eq("mes", mes);

    // Adjust lucroServicoOficina with manual costs
    for (const cm of (custosData || []) as CustoManual[]) {
      const manualTotal = (cm.custo_folha || 0) + (cm.horas_extras || 0) + (cm.custo_terceiros || 0) + (cm.custo_variaveis || 0) + (cm.consumiveis || 0);
      let oldCost = 0;
      for (const r of rows) {
        if (
          r.filial === cm.filial &&
          (r.peca_ou_servico || "").toUpperCase().includes("SERVI") &&
          (r.balcao_ou_oficina || "").toUpperCase().includes("OFICINA") &&
          (r.tipo_midia || "").toUpperCase().includes("OUTRO")
        ) {
          oldCost += r.custo_total || 0;
        }
      }
      const delta = manualTotal - oldCost;
      lucroServicoOficina -= delta;
    }

    // Build consultant results
    const consultores = Array.from(consultorMap.entries())
      .map(([consultor, lucroPecas]) => ({
        consultor,
        lucro_pecas: Math.round(lucroPecas * 100) / 100,
        variavel: Math.round(Math.max(0, lucroPecas * 0.025) * 100) / 100,
      }))
      .sort((a, b) => a.consultor.localeCompare(b.consultor));

    // Encarregado
    const encarregado = {
      lucro_pecas: Math.round(totalLucroPecas * 100) / 100,
      comissao_pecas: Math.round(Math.max(0, totalLucroPecas * 0.02) * 100) / 100,
      lucro_servico_oficina: Math.round(lucroServicoOficina * 100) / 100,
      comissao_servico: Math.round(Math.max(0, lucroServicoOficina * 0.03) * 100) / 100,
      total: Math.round((Math.max(0, totalLucroPecas * 0.02) + Math.max(0, lucroServicoOficina * 0.03)) * 100) / 100,
    };

    return NextResponse.json({ consultores, encarregado });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
