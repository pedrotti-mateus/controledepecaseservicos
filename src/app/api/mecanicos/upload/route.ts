import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { parseMecanicosPDF } from "@/lib/parse-mecanicos-pdf";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Nenhum arquivo enviado" },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Apenas arquivos PDF sao aceitos" },
        { status: 400 }
      );
    }

    // Parse PDF
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await parseMecanicosPDF(buffer);

    if (result.mecanicos.length === 0) {
      return NextResponse.json(
        { error: "Nenhum mecanico encontrado no PDF" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Store PDF in Supabase Storage
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const storagePath = `mecanicos/${timestamp}_${file.name}`;
    const { error: storageError } = await supabase.storage
      .from("uploads")
      .upload(storagePath, buffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (storageError) {
      console.error("Storage upload error:", storageError.message);
    }

    // Delete existing records for this month/year
    await supabase
      .from("comissoes_mecanicos")
      .delete()
      .eq("ano", result.ano)
      .eq("mes", result.mes);

    // Insert new records
    const records = result.mecanicos.map((m) => ({
      mecanico: m.mecanico,
      ano: result.ano,
      mes: result.mes,
      valor_servicos: m.valor_servicos,
      comissao_total: m.comissao_total,
      percentual_comissao: m.percentual_comissao,
      num_ordens: m.num_ordens,
    }));

    const { error: insertError } = await supabase
      .from("comissoes_mecanicos")
      .insert(records);

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    // Store detail records (gracefully handle if table doesn't exist yet)
    try {
      await supabase
        .from("comissoes_mecanicos_detalhe")
        .delete()
        .eq("ano", result.ano)
        .eq("mes", result.mes);

      const detailRecords: Array<{
        mecanico: string;
        ano: number;
        mes: number;
        numero_os: string;
        cliente: string;
        valor_servico: number;
        comissao: number;
      }> = [];

      for (const m of result.mecanicos) {
        for (const o of m.ordens) {
          detailRecords.push({
            mecanico: m.mecanico,
            ano: result.ano,
            mes: result.mes,
            numero_os: o.numero_os,
            cliente: o.cliente,
            valor_servico: o.valor_servico,
            comissao: o.comissao,
          });
        }
      }

      if (detailRecords.length > 0) {
        for (let idx = 0; idx < detailRecords.length; idx += 500) {
          await supabase
            .from("comissoes_mecanicos_detalhe")
            .insert(detailRecords.slice(idx, idx + 500));
        }
      }
    } catch {
      // Table might not exist yet - continue without storing details
    }

    // Log the upload (try with tipo, fallback without if column doesn't exist)
    const logData = {
      nome_arquivo: file.name,
      tamanho_bytes: file.size,
      total_registros: result.mecanicos.length,
      registros_inseridos: result.mecanicos.length,
      storage_path: storageError ? null : storagePath,
      status: "sucesso",
      erros: null,
      tipo: "mecanicos",
    };
    const { error: logError } = await supabase.from("upload_logs").insert(logData);
    if (logError) {
      const { tipo: _, ...logWithoutTipo } = logData;
      await supabase.from("upload_logs").insert(logWithoutTipo);
    }

    return NextResponse.json({
      success: true,
      periodo: `${result.mes}/${result.ano}`,
      mecanicos: result.mecanicos.length,
      total_servicos: result.total_geral_servicos,
      total_comissao: result.total_geral_comissao,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
