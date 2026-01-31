import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import * as XLSX from "xlsx";

const COLUMN_MAP: Record<number, string> = {
  0: "qtd_doc",
  1: "nota",
  2: "os_vb",
  3: "referencia",
  4: "cod_item",
  5: "peca_servico_nome",
  6: "pessoa_tipo",
  7: "codigo_cliente",
  8: "cliente",
  9: "data",
  10: "serie",
  11: "filial",
  12: "peca_ou_servico",
  13: "venda_devolucao",
  14: "tipo_preco",
  15: "condicao_pagamento",
  16: "balcao_ou_oficina",
  17: "tipo_os",
  18: "consultor",
  19: "conveniado",
  20: "tipo_midia",
  21: "cfop",
  22: "uf_cliente",
  23: "cidade_cliente",
  24: "bairro_cliente",
  25: "email_cliente",
  26: "telefone_cliente",
  27: "produto_servico",
  28: "modalidade_venda",
  29: "familia_modelo_veiculo",
  30: "marca_produto",
  31: "categoria_peca_servico",
  32: "modelo",
  33: "venda_bruta_1",
  34: "venda_bruta_2",
  35: "faturamento",
  36: "impostos",
  37: "venda_liquida",
  38: "icms_iss",
  39: "pis",
  40: "cofins",
  41: "qtd_item",
  42: "bandeira_pedido",
  43: "custo_total",
  44: "lucro_rs",
  45: "margem_pct",
  46: "valor_contabil",
  47: "markup_pct",
  48: "ipi",
  49: "icms_st",
  50: "frete",
  51: "seguro",
  52: "despesas",
};

function parseDate(value: unknown): string | null {
  if (!value) return null;

  // If it's a JS Date object (from Excel serial number conversion)
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // If it's a string like "06/01/2026 13:59:31"
  if (typeof value === "string") {
    const match = value.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (match) {
      return `${match[3]}-${match[2]}-${match[1]}`;
    }
    // Try ISO format
    const isoMatch = value.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }
  }

  // If it's a number (Excel serial date)
  if (typeof value === "number") {
    const date = new Date((value - 25569) * 86400 * 1000);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  return null;
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
    });

    // Find the header row (row with "Qtd. Doc." as first cell)
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(10, rawData.length); i++) {
      const firstCell = String(rawData[i]?.[0] || "").trim();
      if (firstCell === "Qtd. Doc.") {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      return NextResponse.json(
        { error: "Formato de arquivo inválido. Não encontrei o cabeçalho 'Qtd. Doc.'" },
        { status: 400 }
      );
    }

    // Data starts after the header row
    const dataRows = rawData.slice(headerRowIndex + 1).filter((row) => {
      // Filter out completely empty rows
      return row.some((cell) => cell !== null && cell !== undefined && cell !== "");
    });

    if (dataRows.length === 0) {
      return NextResponse.json({ error: "Nenhum dado encontrado no arquivo" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Persist file in Supabase Storage
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const storagePath = `${timestamp}_${file.name}`;
    const { error: storageError } = await supabase.storage
      .from("uploads")
      .upload(storagePath, buffer, {
        contentType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: false,
      });

    if (storageError) {
      console.error("Storage upload error:", storageError.message);
    }

    // Smart overlap: find the earliest date in the uploaded file,
    // delete all existing records from that date onwards, then insert new data.
    let minDateInFile: string | null = null;
    for (const row of dataRows) {
      const dateVal = parseDate(row[9]); // column 9 = data
      if (dateVal) {
        if (!minDateInFile || dateVal < minDateInFile) {
          minDateInFile = dateVal;
        }
      }
    }

    let deletedInfo = "";
    if (minDateInFile) {
      // Round down to the 1st of the month to replace full months
      const mesInicio = minDateInFile.slice(0, 7) + "-01";
      const { count } = await supabase
        .from("pecas_servicos")
        .delete({ count: "exact" })
        .gte("data", mesInicio);
      deletedInfo = `Removidos ${count ?? 0} registros a partir de ${mesInicio}. `;
    }

    // Process in batches of 200
    const BATCH_SIZE = 200;
    let inserted = 0;
    let errors: string[] = [];

    for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
      const batch = dataRows.slice(i, i + BATCH_SIZE);
      const records = batch.map((row) => {
        const record: Record<string, unknown> = {};
        for (const [colIdx, colName] of Object.entries(COLUMN_MAP)) {
          const idx = parseInt(colIdx);
          let value = row[idx] ?? null;

          if (colName === "data") {
            value = parseDate(value);
          } else if (
            [
              "venda_bruta_1",
              "venda_bruta_2",
              "faturamento",
              "impostos",
              "venda_liquida",
              "icms_iss",
              "pis",
              "cofins",
              "qtd_item",
              "custo_total",
              "lucro_rs",
              "margem_pct",
              "valor_contabil",
              "markup_pct",
              "ipi",
              "icms_st",
              "frete",
              "seguro",
              "despesas",
            ].includes(colName)
          ) {
            value = parseNumber(value);
          } else if (["qtd_doc", "cod_item", "codigo_cliente", "cfop"].includes(colName)) {
            value = parseNumber(value);
          } else if (colName === "os_vb") {
            value = value !== null ? String(value) : null;
          } else {
            value = value !== null ? String(value) : null;
          }

          record[colName] = value;
        }
        return record;
      });

      const { error } = await supabase.from("pecas_servicos").insert(records);
      if (error) {
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
      } else {
        inserted += batch.length;
      }
    }

    // Log the upload (try with tipo, fallback without if column doesn't exist)
    const status = errors.length > 0 ? (inserted > 0 ? "parcial" : "erro") : "sucesso";
    const logData = {
      nome_arquivo: file.name,
      tamanho_bytes: file.size,
      total_registros: dataRows.length,
      registros_inseridos: inserted,
      storage_path: storageError ? null : storagePath,
      status,
      erros: errors.length > 0 ? errors : null,
      tipo: "pecas_servicos",
    };
    const { error: logError } = await supabase.from("upload_logs").insert(logData);
    if (logError) {
      const { tipo: _, ...logWithoutTipo } = logData;
      await supabase.from("upload_logs").insert(logWithoutTipo);
    }

    return NextResponse.json({
      success: true,
      total_rows: dataRows.length,
      inserted,
      message: deletedInfo + `Inseridos ${inserted} registros.`,
      data_inicio: minDateInFile,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
