/* eslint-disable @typescript-eslint/no-require-imports */

export interface OrdemServico {
  numero_os: string;
  cliente: string;
  valor_servico: number;
  comissao: number;
}

export interface MecanicoData {
  mecanico: string;
  valor_servicos: number;
  comissao_total: number;
  percentual_comissao: number;
  num_ordens: number;
  ordens: OrdemServico[];
}

export interface ParseResult {
  ano: number;
  mes: number;
  mecanicos: MecanicoData[];
  total_geral_servicos: number;
  total_geral_comissao: number;
}

/** Brazilian number regex: matches "1.234,56" or "56,00" or "0,00" */
const BR_NUM = /\d{1,3}(?:\.\d{3})*,\d{2}/;

/** Parse "1.234,56" → 1234.56 */
function parseBRNumber(value: string): number {
  return parseFloat(value.replace(/\./g, "").replace(",", ".")) || 0;
}

/**
 * Extract two concatenated BR numbers from a string like "2.098,405.246,01"
 * Returns [first, second] as strings, or null if not found.
 */
function splitConcatenatedNumbers(str: string): [string, string] | null {
  // A BR number always ends with ,XX (comma + 2 digits)
  // Match first number ending with ,XX then second number starting right after
  const match = str.match(
    new RegExp(`(${BR_NUM.source})(${BR_NUM.source})`)
  );
  if (match) return [match[1], match[2]];
  return null;
}

/** Lines to skip when extracting client names (page headers, column headers) */
const SKIP_LINE =
  /^(Página|RELAT[OÓ]RIO|EMITIDO|MATEUS@|D\d+$|Empresa|finaliza|N\.\s*OS$|COMISS[AÃ]O$|TOTAL$|VALOR$|SERVI[CÇ]OS$|DATA\s+DE$|FECHAMENTO$|VALOR\s+COM|%\s*COM|CLIENTE$|VERS[AÃ]O|SANCES)/i;

/**
 * Extract all BR numbers from a string, even if concatenated.
 * "110,00275,00" → [110, 275]
 */
function extractAllBRNumbers(str: string): number[] {
  const nums: number[] = [];
  let remaining = str;
  while (remaining) {
    const m = remaining.match(new RegExp(BR_NUM.source));
    if (!m || m.index === undefined) break;
    nums.push(parseBRNumber(m[0]));
    remaining = remaining.substring(m.index + m[0].length);
  }
  return nums;
}

/**
 * Extract individual order entries (OS number, client, values) from
 * the text between a mechanic header and their TOTAL line.
 *
 * PDF format per entry (each item on its own line):
 *   68146                         ← OS number alone
 *   110,00275,00                  ← concatenated comissao + valor_servicos
 *   15/01/2026                    ← date (sometimes absent)
 *   110,0040,00                   ← concatenated valor_comissao + percentual
 *   TRR ZANFORLIN COM             ← client name (can span
 *   COMBUSTIVEIS LTDA             ←  multiple lines)
 */
function parseOrdens(osText: string): OrdemServico[] {
  const ordens = new Map<string, OrdemServico>();
  const textLines = osText.split("\n");

  // 1. Identify line indices that have OS numbers (5-digit, 60000-99999)
  const osEntries: Array<{ idx: number; numero_os: string }> = [];
  for (let i = 0; i < textLines.length; i++) {
    const line = textLines[i].trim();
    if (!line) continue;
    const osMatch = line.match(/\b(\d{5})\b/);
    if (!osMatch) continue;
    const num = parseInt(osMatch[1], 10);
    if (num < 60000 || num > 99999) continue;
    osEntries.push({ idx: i, numero_os: osMatch[1] });
  }

  // 2. For each OS, collect all lines until the next OS and classify them
  for (let k = 0; k < osEntries.length; k++) {
    const { idx, numero_os } = osEntries[k];
    if (ordens.has(numero_os)) continue;

    const endIdx = k + 1 < osEntries.length
      ? osEntries[k + 1].idx
      : textLines.length;

    const clientParts: string[] = [];
    const brNums: number[] = [];

    for (let j = idx + 1; j < endIdx; j++) {
      const line = textLines[j].trim();
      if (!line) continue;
      if (/TOTAL/i.test(line)) break;
      if (/mec[aâ]nico:/i.test(line)) break;
      if (SKIP_LINE.test(line)) continue;

      // Date line (DD/MM/YYYY)
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(line)) continue;

      // Line with BR numbers → extract values
      if (new RegExp(BR_NUM.source).test(line)) {
        brNums.push(...extractAllBRNumbers(line));
        continue;
      }

      // Text line → client name
      clientParts.push(line);
    }

    const cliente = clientParts.join(" ").trim();

    // From the BR numbers, the first pair is: comissao, valor_servicos
    let valor_servico = 0;
    let comissao = 0;
    if (brNums.length >= 2) {
      comissao = brNums[0];
      valor_servico = brNums[1];
    } else if (brNums.length === 1) {
      valor_servico = brNums[0];
    }

    ordens.set(numero_os, { numero_os, cliente, valor_servico, comissao });
  }

  return Array.from(ordens.values());
}

/**
 * Parse the "Relatório de Comissão dos Mecânicos" PDF and extract
 * per-mechanic summary data (valor servicos + comissao total).
 */
export async function parseMecanicosPDF(buffer: Buffer): Promise<ParseResult> {
  const pdf = require("pdf-parse");
  const pdfData = await pdf(buffer);
  const text: string = pdfData.text;
  const lines = text.split("\n");

  // 1. Extract period from header
  const periodMatch = text.match(
    /De\s+(\d{2})\/(\d{2})\/(\d{4})\s+at[eé]/i
  );
  if (!periodMatch) {
    throw new Error("Periodo nao encontrado no PDF");
  }
  const mes = parseInt(periodMatch[2], 10);
  const ano = parseInt(periodMatch[3], 10);

  // 2. Find all mechanic names and their line positions
  //    Pattern: "Mecânico:  NOME" (with double space)
  const mecanicoPositions: Array<{ name: string; lineIdx: number }> = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/Mec[aâ]nico:\s+(.+)/i);
    if (m) {
      const name = m[1].trim();
      if (name) {
        mecanicoPositions.push({ name, lineIdx: i });
      }
    }
  }

  // 3. Find all TOTAL MECÂNICO lines and extract data
  //    The actual text pattern (from pdf-parse extraction):
  //    - Line before TOTAL: "{comissao}{valor_servicos}" concatenated (e.g. "2.098,405.246,01")
  //    - Line: "TOTAL MECÂNICO:"
  //    - Line after: "{comissao}" alone (e.g. "2.098,40")
  const mecanicosMap = new Map<
    string,
    { valor_servicos: number; comissao_total: number; osLines: string }
  >();

  for (let i = 0; i < lines.length; i++) {
    if (!/TOTAL\s+MEC[AÂ]NICO:/i.test(lines[i])) continue;

    // Get comissao from the next line
    const nextLine = (lines[i + 1] || "").trim();
    const comissaoMatch = nextLine.match(new RegExp(`^(${BR_NUM.source})`));
    if (!comissaoMatch) continue;
    const comissao_total = parseBRNumber(comissaoMatch[1]);

    // Get valor_servicos from the previous line (contains {comissao}{valor} concatenated)
    const prevLine = (lines[i - 1] || "").trim();
    const nums = splitConcatenatedNumbers(prevLine);
    const valor_servicos = nums ? parseBRNumber(nums[1]) : 0;

    // Find which mechanic this TOTAL belongs to
    // It's the closest "Mecânico:" line that appeared before this TOTAL
    let ownerName = "";
    for (let j = mecanicoPositions.length - 1; j >= 0; j--) {
      if (mecanicoPositions[j].lineIdx < i) {
        ownerName = mecanicoPositions[j].name;
        break;
      }
    }
    if (!ownerName) continue;

    // Only store the first TOTAL per mechanic (some mechanics span pages
    // but only have one TOTAL MECÂNICO at the end)
    if (mecanicosMap.has(ownerName)) continue;

    // Collect all text between first occurrence of this mechanic and the TOTAL line
    // to count OS numbers
    let osText = "";
    for (let j = 0; j < mecanicoPositions.length; j++) {
      if (mecanicoPositions[j].name === ownerName) {
        const startLine = mecanicoPositions[j].lineIdx;
        // Find the end: either the TOTAL line or the next mechanic section
        let endLine = i;
        for (let k = j + 1; k < mecanicoPositions.length; k++) {
          if (mecanicoPositions[k].name !== ownerName) {
            endLine = Math.min(endLine, mecanicoPositions[k].lineIdx);
            break;
          }
        }
        osText += lines.slice(startLine, endLine + 1).join("\n") + "\n";
      }
    }
    // Also add lines from the last section up to TOTAL
    const lastSection = [...mecanicoPositions]
      .reverse()
      .find((p) => p.name === ownerName && p.lineIdx < i);
    if (lastSection) {
      osText += lines.slice(lastSection.lineIdx, i).join("\n");
    }

    mecanicosMap.set(ownerName, { valor_servicos, comissao_total, osLines: osText });
  }

  // 4. Build result array
  const mecanicos: MecanicoData[] = [];
  for (const [name, data] of mecanicosMap) {
    // Count unique OS numbers (5-digit numbers in range 60000-99999)
    const osNumbers = new Set<string>();
    for (const m of data.osLines.matchAll(/\b(\d{5})\b/g)) {
      const num = parseInt(m[1], 10);
      if (num >= 60000 && num <= 99999) {
        osNumbers.add(m[1]);
      }
    }

    const percentual_comissao =
      data.valor_servicos > 0
        ? Math.round((data.comissao_total / data.valor_servicos) * 10000) / 100
        : 0;

    const ordensArr = parseOrdens(data.osLines);

    mecanicos.push({
      mecanico: name,
      valor_servicos: data.valor_servicos,
      comissao_total: data.comissao_total,
      percentual_comissao,
      num_ordens: osNumbers.size,
      ordens: ordensArr,
    });
  }

  // 5. Extract TOTAL GERAL
  //    Pattern: "67.481,60156.942,75TOTAL GERAL:67.481,60" (all on one line)
  let total_geral_servicos = 0;
  let total_geral_comissao = 0;

  const geralLine = lines.find((l) => /TOTAL\s+GERAL:/i.test(l));
  if (geralLine) {
    // Extract the number after "TOTAL GERAL:"
    const afterGeral = geralLine.match(
      /TOTAL\s+GERAL:\s*([\d.,]+)/i
    );
    if (afterGeral) {
      total_geral_comissao = parseBRNumber(afterGeral[1]);
    }
    // Extract the two numbers before "TOTAL GERAL:"
    const beforeGeral = geralLine.match(
      new RegExp(`(${BR_NUM.source})(${BR_NUM.source})\\s*TOTAL\\s+GERAL:`, "i")
    );
    if (beforeGeral) {
      total_geral_servicos = parseBRNumber(beforeGeral[2] || beforeGeral[1]);
    }
  }

  return {
    ano,
    mes,
    mecanicos,
    total_geral_servicos,
    total_geral_comissao,
  };
}
