/**
 * Calcula o prazo médio de recebimento (TMR) com base na condição de pagamento.
 * Retorna o prazo em dias.
 *
 * Regras:
 * - PIX, Dinheiro, Cartão de Crédito, Cartão Débito, Ordem de Pagamento, Sem condição => 0 dias
 * - Carteira => ignorar (retorna null)
 * - Cartão de Crédito Parcelado => 0 dias
 * - Boletos => interpreta os prazos das parcelas e tira a média
 * - Cheque a prazo => interpreta como 30 dias (padrão)
 * - Ordem de Pagamento com prazo => interpreta os prazos
 */
export function calcularPrazoCondicao(condicao: string | null): number | null {
  if (!condicao) return 0;

  const upper = condicao.toUpperCase().trim();

  // Ignorar carteira
  if (upper === "CARTEIRA") return null;

  // Condições com prazo 0
  if (
    upper === "PIX" ||
    upper === "DINHEIRO" ||
    upper === "CARTAO DE CREDITO" ||
    upper === "CARTÃO DE CREDITO" ||
    upper === "CARTAO DEBITO" ||
    upper === "CARTÃO DEBITO" ||
    upper === "CARTÃO DE CREDITO PARCELADO" ||
    upper === "CARTAO DE CREDITO PARCELADO" ||
    upper === "SEM CONDIÇÃO" ||
    upper === "SEM CONDICAO"
  ) {
    return 0;
  }

  // Ordem de pagamento simples = 0 dias
  if (upper === "ORDEM DE PAGAMENTO - OP" || upper === "ORDEM DE PAGAMENTO") {
    return 0;
  }

  // Ordem de pagamento com prazos (ex: "ORDEM DE PAGAMENTO - OP 28/56/84")
  if (upper.startsWith("ORDEM DE PAGAMENTO")) {
    const prazos = extrairPrazos(upper);
    if (prazos.length > 0) {
      return Math.round(prazos.reduce((a, b) => a + b, 0) / prazos.length);
    }
    return 0;
  }

  // Boletos - extrair prazos
  if (upper.startsWith("BOLETO")) {
    const prazos = extrairPrazos(upper);
    if (prazos.length > 0) {
      return Math.round(prazos.reduce((a, b) => a + b, 0) / prazos.length);
    }
    // Boleto sem prazo identificável - padrão 28 dias
    return 28;
  }

  // Cheque a prazo
  if (upper.includes("CHEQUE")) {
    const prazos = extrairPrazos(upper);
    if (prazos.length > 0) {
      return Math.round(prazos.reduce((a, b) => a + b, 0) / prazos.length);
    }
    return 30;
  }

  // Fallback - tenta extrair números
  const prazos = extrairPrazos(upper);
  if (prazos.length > 0) {
    return Math.round(prazos.reduce((a, b) => a + b, 0) / prazos.length);
  }

  return 0;
}

/**
 * Extrai prazos numéricos de uma string.
 * Ex: "BOLETO 28/56/84 DIAS" => [28, 56, 84]
 * Ex: "BOLETO 20/40 DIAS" => [20, 40]
 * Ex: "BOLETO 7 DIAS" => [7]
 */
function extrairPrazos(texto: string): number[] {
  // Remove palavras comuns para isolar os números
  const limpo = texto
    .replace(/BOLETO/gi, "")
    .replace(/DIAS/gi, "")
    .replace(/ORDEM DE PAGAMENTO/gi, "")
    .replace(/- OP/gi, "")
    .trim();

  // Tenta encontrar padrão "N/N/N..."
  const partes = limpo.split("/").map((p) => p.trim());
  const numeros: number[] = [];

  for (const parte of partes) {
    const num = parseInt(parte, 10);
    if (!isNaN(num) && num > 0) {
      numeros.push(num);
    }
  }

  return numeros;
}

/**
 * Calcula o TMR ponderado pelo faturamento.
 * TMR = Σ(faturamento_i × prazo_i) / Σ(faturamento_i)
 * Ignora registros com condição "Carteira".
 */
export function calcularTMR(
  registros: Array<{ condicao_pagamento: string | null; faturamento: number }>
): number {
  let somaFatPrazo = 0;
  let somaFat = 0;

  for (const reg of registros) {
    const prazo = calcularPrazoCondicao(reg.condicao_pagamento);
    if (prazo === null) continue; // Ignora carteira

    const fat = Math.abs(reg.faturamento || 0);
    somaFatPrazo += fat * prazo;
    somaFat += fat;
  }

  if (somaFat === 0) return 0;
  return Math.round((somaFatPrazo / somaFat) * 100) / 100;
}
