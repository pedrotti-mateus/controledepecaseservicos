"use client";

import { useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const MESES = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const MESES_CURTO = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pdfHeader(doc: jsPDF, titulo: string, periodo: string) {
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Grupo Pedrotti", 14, 18);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Controle de Pecas e Servicos", 14, 24);

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(titulo, 14, 36);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Periodo: ${periodo}`, 14, 42);
}

function pdfFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150);
    doc.text(
      `Gerado em ${new Date().toLocaleString("pt-BR")} - Pagina ${i}/${pageCount}`,
      14,
      doc.internal.pageSize.height - 10
    );
    doc.setTextColor(0);
  }
}

export default function RelatoriosPage() {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [mesSelecionado, setMesSelecionado] = useState(new Date().getMonth());
  const [gerando, setGerando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const periodo = `${MESES[mesSelecionado]}/${ano}`;
  const periodoArquivo = `${MESES_CURTO[mesSelecionado]}_${ano}`;

  async function gerarTSAlinhamentos() {
    setGerando("ts");
    setErro(null);
    try {
      const res = await fetch(`/api/relatorios/ts-alinhamentos?ano=${ano}&mes=${mesSelecionado + 1}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      const data: Array<{
        mecanico: string;
        num_ordens: number;
        valor_servicos: number;
        percentual_comissao: number;
        comissao_total: number;
      }> = json.data || [];

      const detalhes: Array<{
        mecanico: string;
        numero_os: string;
        cliente: string;
        valor_servico: number;
        comissao: number;
      }> = json.detalhes || [];

      if (data.length === 0) {
        setErro("Nenhum dado encontrado para o periodo selecionado");
        return;
      }

      const doc = new jsPDF();
      pdfHeader(doc, "Relatorio TS Alinhamentos", periodo);

      // Summary table
      const totais = {
        num_ordens: 0,
        valor_servicos: 0,
        comissao_total: 0,
      };

      const rows = data.map((d) => {
        totais.num_ordens += d.num_ordens || 0;
        totais.valor_servicos += d.valor_servicos || 0;
        totais.comissao_total += d.comissao_total || 0;
        return [
          d.mecanico,
          String(d.num_ordens || 0),
          formatBRL(d.valor_servicos || 0),
          (d.percentual_comissao || 0).toFixed(2) + "%",
          formatBRL(d.comissao_total || 0),
        ];
      });

      const pctMedio = totais.valor_servicos > 0
        ? ((totais.comissao_total / totais.valor_servicos) * 100).toFixed(2) + "%"
        : "0.00%";

      rows.push([
        "TOTAL",
        String(totais.num_ordens),
        formatBRL(totais.valor_servicos),
        pctMedio,
        formatBRL(totais.comissao_total),
      ]);

      autoTable(doc, {
        startY: 48,
        head: [["Mecanico", "Ordens", "Valor Servicos", "% Variavel", "Variavel Total"]],
        body: rows,
        theme: "grid",
        headStyles: { fillColor: [30, 41, 59], fontSize: 9, fontStyle: "bold" },
        bodyStyles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 70 },
          1: { halign: "right", cellWidth: 20 },
          2: { halign: "right", cellWidth: 35 },
          3: { halign: "right", cellWidth: 28 },
          4: { halign: "right", cellWidth: 35 },
        },
        didParseCell: (hookData) => {
          if (hookData.row.index === rows.length - 1 && hookData.section === "body") {
            hookData.cell.styles.fontStyle = "bold";
            hookData.cell.styles.fillColor = [241, 245, 249];
          }
        },
      });

      // Detail tables per mechanic (if details available)
      if (detalhes.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let cursorY = (doc as any).lastAutoTable?.finalY || 80;

        for (const mec of data) {
          const mecDetalhes = detalhes.filter((d) => d.mecanico === mec.mecanico);
          if (mecDetalhes.length === 0) continue;

          cursorY += 10;
          if (cursorY > doc.internal.pageSize.height - 40) {
            doc.addPage();
            cursorY = 20;
          }

          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.text(`Detalhes - ${mec.mecanico}`, 14, cursorY);
          cursorY += 4;

          const detRows = mecDetalhes.map((d) => [
            d.numero_os,
            d.cliente || "-",
            formatBRL(d.valor_servico || 0),
            formatBRL(d.comissao || 0),
          ]);

          autoTable(doc, {
            startY: cursorY,
            head: [["OS", "Cliente", "Valor Servico", "Variavel"]],
            body: detRows,
            theme: "grid",
            headStyles: { fillColor: [71, 85, 105], fontSize: 8, fontStyle: "bold" },
            bodyStyles: { fontSize: 8 },
            columnStyles: {
              0: { cellWidth: 20 },
              1: { cellWidth: 90 },
              2: { halign: "right", cellWidth: 35 },
              3: { halign: "right", cellWidth: 35 },
            },
          });

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          cursorY = (doc as any).lastAutoTable?.finalY || cursorY + 20;
        }
      }

      pdfFooter(doc);
      doc.save(`TS_Alinhamentos_${periodoArquivo}.pdf`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao gerar relatorio");
    } finally {
      setGerando(null);
    }
  }

  async function gerarVariavelMecanicos() {
    setGerando("mecanicos");
    setErro(null);
    try {
      const res = await fetch(`/api/relatorios/variavel-mecanicos?ano=${ano}&mes=${mesSelecionado + 1}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      const data: Array<{
        mecanico: string;
        filial: string | null;
        comissao_total: number;
        salario_fixo: number;
        variavel: number;
      }> = json.data || [];

      if (data.length === 0) {
        setErro("Nenhum mecanico comissionado encontrado");
        return;
      }

      const doc = new jsPDF();
      pdfHeader(doc, "Relatorio Variavel dos Mecanicos", periodo);

      const totais = { comissao: 0, salario: 0, variavel: 0 };

      const rows = data.map((d) => {
        totais.comissao += d.comissao_total;
        totais.salario += d.salario_fixo;
        totais.variavel += d.variavel;
        return [
          d.mecanico,
          d.filial || "-",
          formatBRL(d.comissao_total),
          formatBRL(d.salario_fixo),
          formatBRL(d.variavel),
        ];
      });

      rows.push([
        "TOTAL",
        "",
        formatBRL(totais.comissao),
        formatBRL(totais.salario),
        formatBRL(totais.variavel),
      ]);

      autoTable(doc, {
        startY: 48,
        head: [["Mecanico", "Filial", "Variavel Bruta", "Salario Fixo", "Variavel"]],
        body: rows,
        theme: "grid",
        headStyles: { fillColor: [30, 41, 59], fontSize: 9, fontStyle: "bold" },
        bodyStyles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 55 },
          1: { cellWidth: 35 },
          2: { halign: "right", cellWidth: 30 },
          3: { halign: "right", cellWidth: 30 },
          4: { halign: "right", cellWidth: 30 },
        },
        didParseCell: (hookData) => {
          if (hookData.row.index === rows.length - 1 && hookData.section === "body") {
            hookData.cell.styles.fontStyle = "bold";
            hookData.cell.styles.fillColor = [241, 245, 249];
          }
        },
      });

      pdfFooter(doc);
      doc.save(`Variavel_Mecanicos_${periodoArquivo}.pdf`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao gerar relatorio");
    } finally {
      setGerando(null);
    }
  }

  async function gerarVariavelConsultores() {
    setGerando("consultores");
    setErro(null);
    try {
      const res = await fetch(`/api/relatorios/variavel-consultores?ano=${ano}&mes=${mesSelecionado + 1}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      const consultores: Array<{
        consultor: string;
        lucro_pecas: number;
        variavel: number;
      }> = json.consultores || [];

      const encarregado: {
        lucro_pecas: number;
        comissao_pecas: number;
        lucro_servico_oficina: number;
        comissao_servico: number;
        total: number;
      } = json.encarregado || { lucro_pecas: 0, comissao_pecas: 0, lucro_servico_oficina: 0, comissao_servico: 0, total: 0 };

      if (consultores.length === 0) {
        setErro("Nenhum dado de consultor encontrado para o periodo");
        return;
      }

      const doc = new jsPDF();
      pdfHeader(doc, "Relatorio Variavel dos Consultores", periodo);

      // Consultores table
      let totalVariavel = 0;
      const rows = consultores.map((c) => {
        totalVariavel += c.variavel;
        return [
          c.consultor,
          formatBRL(c.lucro_pecas),
          "2,5%",
          formatBRL(c.variavel),
        ];
      });

      rows.push([
        "SUBTOTAL CONSULTORES",
        "",
        "",
        formatBRL(totalVariavel),
      ]);

      autoTable(doc, {
        startY: 48,
        head: [["Consultor", "Lucro Pecas", "%", "Variavel"]],
        body: rows,
        theme: "grid",
        headStyles: { fillColor: [30, 41, 59], fontSize: 9, fontStyle: "bold" },
        bodyStyles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { halign: "right", cellWidth: 40 },
          2: { halign: "right", cellWidth: 20 },
          3: { halign: "right", cellWidth: 35 },
        },
        didParseCell: (hookData) => {
          if (hookData.row.index === rows.length - 1 && hookData.section === "body") {
            hookData.cell.styles.fontStyle = "bold";
            hookData.cell.styles.fillColor = [241, 245, 249];
          }
        },
      });

      // Encarregado table
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prevTableEnd = (doc as any).lastAutoTable?.finalY || 80;

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Variavel do Encarregado", 14, prevTableEnd + 12);

      const encRows = [
        ["Pecas (2%)", formatBRL(encarregado.lucro_pecas), "2%", formatBRL(encarregado.comissao_pecas)],
        ["Servico Oficina (3%)", formatBRL(encarregado.lucro_servico_oficina), "3%", formatBRL(encarregado.comissao_servico)],
        ["TOTAL ENCARREGADO", "", "", formatBRL(encarregado.total)],
      ];

      autoTable(doc, {
        startY: prevTableEnd + 16,
        head: [["Tipo", "Lucro Base", "%", "Variavel"]],
        body: encRows,
        theme: "grid",
        headStyles: { fillColor: [30, 58, 138], fontSize: 9, fontStyle: "bold" },
        bodyStyles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { halign: "right", cellWidth: 40 },
          2: { halign: "right", cellWidth: 20 },
          3: { halign: "right", cellWidth: 35 },
        },
        didParseCell: (hookData) => {
          if (hookData.row.index === encRows.length - 1 && hookData.section === "body") {
            hookData.cell.styles.fontStyle = "bold";
            hookData.cell.styles.fillColor = [241, 245, 249];
          }
        },
      });

      // Grand total
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const encTableEnd = (doc as any).lastAutoTable?.finalY || 120;
      const grandTotal = totalVariavel + encarregado.total;

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`Total Geral: R$ ${formatBRL(grandTotal)}`, 14, encTableEnd + 10);

      pdfFooter(doc);
      doc.save(`Variavel_Consultores_${periodoArquivo}.pdf`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao gerar relatorio");
    } finally {
      setGerando(null);
    }
  }

  const relatorios = [
    {
      id: "ts",
      titulo: "TS Alinhamentos",
      descricao: "Servicos realizados por Thiago Bernardes e Marcos Alexandre",
      cor: "blue",
      gerar: gerarTSAlinhamentos,
    },
    {
      id: "mecanicos",
      titulo: "Variavel dos Mecanicos",
      descricao: "Comissao descontando salario fixo dos mecanicos comissionados",
      cor: "emerald",
      gerar: gerarVariavelMecanicos,
    },
    {
      id: "consultores",
      titulo: "Variavel dos Consultores",
      descricao: "Variavel de cada consultor (2,5% lucro pecas) e do encarregado",
      cor: "violet",
      gerar: gerarVariavelConsultores,
    },
  ];

  const COR_MAP: Record<string, { bg: string; border: string; text: string; btn: string; btnHover: string }> = {
    blue: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", btn: "bg-blue-600", btnHover: "hover:bg-blue-700" },
    emerald: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", btn: "bg-emerald-600", btnHover: "hover:bg-emerald-700" },
    violet: { bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-700", btn: "bg-violet-600", btnHover: "hover:bg-violet-700" },
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">Relatorios</h1>
        <p className="text-sm text-slate-400 mt-1">
          Gere relatorios em PDF por periodo
        </p>
      </div>

      {/* Period selector */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">
            Ano
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setAno((y) => y - 1)}
              className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-slate-700 w-14 text-center tabular-nums">
              {ano}
            </span>
            <button
              onClick={() => setAno((y) => y + 1)}
              className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        <div>
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide block mb-2">
            Mes
          </span>
          <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
            {MESES_CURTO.map((mes, idx) => {
              const selected = idx === mesSelecionado;
              return (
                <button
                  key={mes}
                  onClick={() => setMesSelecionado(idx)}
                  className={`px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                    selected
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {mes}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Error message */}
      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6 text-sm text-red-700">
          {erro}
        </div>
      )}

      {/* Report cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {relatorios.map((rel) => {
          const cores = COR_MAP[rel.cor];
          const isGerando = gerando === rel.id;
          return (
            <div
              key={rel.id}
              className={`rounded-xl border ${cores.border} ${cores.bg} p-5 flex flex-col`}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div className={`w-8 h-8 rounded-lg ${cores.btn} flex items-center justify-center`}>
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className={`text-sm font-semibold ${cores.text}`}>
                  {rel.titulo}
                </h3>
              </div>
              <p className="text-xs text-slate-500 mb-4 flex-1">
                {rel.descricao}
              </p>
              <button
                onClick={rel.gerar}
                disabled={gerando !== null}
                className={`${cores.btn} ${cores.btnHover} text-white px-4 py-2 rounded-lg text-sm font-medium disabled:bg-slate-200 disabled:text-slate-400 transition-colors flex items-center justify-center gap-2`}
              >
                {isGerando ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Gerando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Gerar PDF
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
