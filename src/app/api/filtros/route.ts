import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createServiceClient();

  // Fetch all consultores with pagination to avoid 1000 row limit
  const allConsultores: string[] = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from("pecas_servicos")
      .select("consultor")
      .not("consultor", "is", null)
      .range(from, from + pageSize - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (data && data.length > 0) {
      allConsultores.push(...data.map((r) => r.consultor));
      from += pageSize;
      if (data.length < pageSize) hasMore = false;
    } else {
      hasMore = false;
    }
  }

  const consultores = [...new Set(allConsultores.filter(Boolean))].sort();

  // Fetch date range
  const { data: minData } = await supabase
    .from("pecas_servicos")
    .select("data")
    .not("data", "is", null)
    .order("data", { ascending: true })
    .limit(1)
    .single();

  const { data: maxData } = await supabase
    .from("pecas_servicos")
    .select("data")
    .not("data", "is", null)
    .order("data", { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({
    consultores,
    dataMin: minData?.data || null,
    dataMax: maxData?.data || null,
  });
}
