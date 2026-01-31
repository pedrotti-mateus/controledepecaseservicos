"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { calcularTMR } from "@/lib/tmr";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  Legend,
} from "recharts";

interface DataRow {
  data: string;
  filial: string;
  peca_ou_servico: string;
  balcao_ou_oficina: string;
  tipo_midia: string;
  consultor: string;
  condicao_pagamento: string | null;
  venda_devolucao: string;
  cliente: string | null;
  faturamento: number;
  impostos: number;
  venda_liquida: number;
  custo_total: number;
  lucro_rs: number;
  margem_pct: number;
}

interface CustoManual {
  id?: number;
  filial: string;
  ano: number;
  mes: number;
  custo_folha: number;
  horas_extras: number;
  custo_terceiros: number;
  custo_variaveis: number;
  consumiveis: number;
}

interface MesChartData {
  mes: string;
  mesIdx: number;
  atual: number;
  anterior: number;
  selecionado: boolean;
}

type MetricaGrafico = "faturamento" | "margem" | "tmr";

interface Totais {
  faturamento: number;
  impostos: number;
  vendaLiquida: number;
  custoTotal: number;
  lucro: number;
  margem: number;
  tmr: number;
  registros: Array<{ condicao_pagamento: string | null; faturamento: number }>;
}

interface TreeNode {
  label: string;
  totais: Totais;
  children: Map<string, TreeNode>;
  expanded: boolean;
  level: number;
}

const MESES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const METRICA_LABELS: Record<MetricaGrafico, string> = {
  faturamento: "Faturamento",
  margem: "Margem %",
  tmr: "TMR (dias)",
};

function calcTotais(rows: DataRow[]): Totais {
  const totais: Totais = {
    faturamento: 0, impostos: 0, vendaLiquida: 0, custoTotal: 0,
    lucro: 0, margem: 0, tmr: 0, registros: [],
  };
  for (const row of rows) {
    totais.faturamento += row.faturamento || 0;
    totais.impostos += row.impostos || 0;
    totais.vendaLiquida += row.venda_liquida || 0;
    totais.custoTotal += row.custo_total || 0;
    totais.lucro += row.lucro_rs || 0;
    totais.registros.push({
      condicao_pagamento: row.condicao_pagamento,
      faturamento: row.faturamento || 0,
    });
  }
  totais.margem = totais.vendaLiquida !== 0 ? (totais.lucro / totais.vendaLiquida) * 100 : 0;
  totais.tmr = calcularTMR(totais.registros);
  return totais;
}

function buildTree(data: DataRow[]): TreeNode {
  const root: TreeNode = {
    label: "Total Geral",
    totais: calcTotais(data),
    children: new Map(),
    expanded: true,
    level: 0,
  };

  for (const row of data) {
    const filial = row.filial || "Sem Filial";
    const pecaServ = row.peca_ou_servico || "Sem Tipo";
    const balcaoOficina = row.balcao_ou_oficina || "Sem Tipo";
    const tipoMidia = row.tipo_midia || "Sem Tipo";

    if (!root.children.has(filial)) {
      root.children.set(filial, {
        label: filial, totais: { faturamento: 0, impostos: 0, vendaLiquida: 0, custoTotal: 0, lucro: 0, margem: 0, tmr: 0, registros: [] },
        children: new Map(), expanded: true, level: 1,
      });
    }
    const filialNode = root.children.get(filial)!;

    if (!filialNode.children.has(pecaServ)) {
      filialNode.children.set(pecaServ, {
        label: pecaServ, totais: { faturamento: 0, impostos: 0, vendaLiquida: 0, custoTotal: 0, lucro: 0, margem: 0, tmr: 0, registros: [] },
        children: new Map(), expanded: true, level: 2,
      });
    }
    const pecaServNode = filialNode.children.get(pecaServ)!;

    if (!pecaServNode.children.has(balcaoOficina)) {
      pecaServNode.children.set(balcaoOficina, {
        label: balcaoOficina, totais: { faturamento: 0, impostos: 0, vendaLiquida: 0, custoTotal: 0, lucro: 0, margem: 0, tmr: 0, registros: [] },
        children: new Map(), expanded: true, level: 3,
      });
    }
    const balcaoNode = pecaServNode.children.get(balcaoOficina)!;

    if (!balcaoNode.children.has(tipoMidia)) {
      balcaoNode.children.set(tipoMidia, {
        label: tipoMidia, totais: { faturamento: 0, impostos: 0, vendaLiquida: 0, custoTotal: 0, lucro: 0, margem: 0, tmr: 0, registros: [] },
        children: new Map(), expanded: false, level: 4,
      });
    }
    const midiaNode = balcaoNode.children.get(tipoMidia)!;

    for (const node of [filialNode, pecaServNode, balcaoNode, midiaNode]) {
      node.totais.faturamento += row.faturamento || 0;
      node.totais.impostos += row.impostos || 0;
      node.totais.vendaLiquida += row.venda_liquida || 0;
      node.totais.custoTotal += row.custo_total || 0;
      node.totais.lucro += row.lucro_rs || 0;
      node.totais.registros.push({
        condicao_pagamento: row.condicao_pagamento,
        faturamento: row.faturamento || 0,
      });
    }
  }

  function finalize(node: TreeNode) {
    node.totais.margem = node.totais.vendaLiquida !== 0 ? (node.totais.lucro / node.totais.vendaLiquida) * 100 : 0;
    node.totais.tmr = calcularTMR(node.totais.registros);
    for (const child of node.children.values()) finalize(child);
  }
  finalize(root);
  return root;
}

/** Compute cost delta for Serviço > Oficina > Outros for a set of rows and manual costs */
function computeCostDelta(
  rows: DataRow[],
  custosManuais: CustoManual[],
  mes: number // 1-based month
): number {
  let delta = 0;
  const filiais = new Set(custosManuais.filter((c) => c.mes === mes).map((c) => c.filial));
  for (const filial of filiais) {
    const cm = custosManuais.find((c) => c.filial === filial && c.mes === mes);
    if (!cm) continue;
    const manualTotal = (cm.custo_folha || 0) + (cm.horas_extras || 0) + (cm.custo_terceiros || 0) + (cm.custo_variaveis || 0) + (cm.consumiveis || 0);
    // Sum old custo_total for matching records
    let oldCost = 0;
    for (const r of rows) {
      if (!r.data) continue;
      const d = new Date(r.data + "T00:00:00");
      if (d.getMonth() + 1 !== mes) continue;
      if (r.filial === filial && (r.peca_ou_servico || "").toUpperCase().includes("SERVI") && (r.balcao_ou_oficina || "").toUpperCase().includes("OFICINA") && (r.tipo_midia || "").toUpperCase().includes("OUTRO")) {
        oldCost += r.custo_total || 0;
      }
    }
    delta += manualTotal - oldCost;
  }
  return delta;
}

/** Apply manual costs to the tree (post-processing) */
function applyManualCosts(root: TreeNode, custosManuais: CustoManual[], mes: number): void {
  for (const cm of custosManuais.filter((c) => c.mes === mes)) {
    const manualTotal = (cm.custo_folha || 0) + (cm.horas_extras || 0) + (cm.custo_terceiros || 0) + (cm.custo_variaveis || 0) + (cm.consumiveis || 0);

    const filialNode = root.children.get(cm.filial);
    if (!filialNode) continue;

    // Find Serviço node (case-insensitive match)
    let servicoNode: TreeNode | undefined;
    for (const [key, node] of filialNode.children) {
      if (key.toUpperCase().includes("SERVI")) { servicoNode = node; break; }
    }
    if (!servicoNode) continue;

    // Find Oficina node
    let oficinaNode: TreeNode | undefined;
    for (const [key, node] of servicoNode.children) {
      if (key.toUpperCase().includes("OFICINA")) { oficinaNode = node; break; }
    }
    if (!oficinaNode) continue;

    // Find Outros node
    let outrosNode: TreeNode | undefined;
    for (const [key, node] of oficinaNode.children) {
      if (key.toUpperCase().includes("OUTRO")) { outrosNode = node; break; }
    }
    if (!outrosNode) continue;

    const oldCost = outrosNode.totais.custoTotal;
    const delta = manualTotal - oldCost;

    // Apply to Outros and propagate up
    for (const node of [outrosNode, oficinaNode, servicoNode, filialNode, root]) {
      node.totais.custoTotal += delta;
      node.totais.lucro -= delta;
      node.totais.margem = node.totais.vendaLiquida !== 0 ? (node.totais.lucro / node.totais.vendaLiquida) * 100 : 0;
    }
  }
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}
function formatPct(value: number): string {
  return value.toFixed(2) + "%";
}
function formatDias(value: number): string {
  return value.toFixed(1) + " dias";
}

const LEVEL_STYLES: Record<number, string> = {
  0: "bg-slate-800 text-white font-bold",
  1: "bg-blue-50/80 text-slate-800 font-semibold",
  2: "bg-slate-50 text-slate-700 font-medium",
  3: "bg-white text-slate-600",
  4: "bg-white text-slate-500",
};

function TreeRow({ node, onToggle }: { node: TreeNode; onToggle: (node: TreeNode) => void }) {
  const hasChildren = node.children.size > 0;
  const indent = node.level * 24;
  const style = LEVEL_STYLES[node.level] || "bg-white text-slate-500";

  return (
    <>
      <tr
        className={`${style} border-b border-slate-100 transition-colors ${hasChildren ? "cursor-pointer hover:brightness-95" : ""}`}
        onClick={() => hasChildren && onToggle(node)}
      >
        <td className="px-3 py-2.5 whitespace-nowrap" style={{ paddingLeft: `${indent + 12}px` }}>
          <div className="flex items-center gap-2">
            {hasChildren ? (
              <svg className={`w-3.5 h-3.5 transition-transform ${node.expanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            ) : (
              <span className="w-3.5" />
            )}
            <span className="text-[13px]">{node.label}</span>
          </div>
        </td>
        <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums text-[13px]">{formatBRL(node.totais.faturamento)}</td>
        <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums text-[13px]">{formatBRL(node.totais.impostos)}</td>
        <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums text-[13px]">{formatBRL(node.totais.vendaLiquida)}</td>
        <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums text-[13px]">{formatBRL(node.totais.custoTotal)}</td>
        <td className={`px-3 py-2.5 text-right whitespace-nowrap tabular-nums text-[13px] ${node.totais.lucro < 0 ? "text-red-600" : ""}`}>
          {formatBRL(node.totais.lucro)}
        </td>
        <td className={`px-3 py-2.5 text-right whitespace-nowrap tabular-nums text-[13px] ${node.totais.margem < 0 ? "text-red-600" : ""}`}>
          {formatPct(node.totais.margem)}
        </td>
        <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums text-[13px]">{formatDias(node.totais.tmr)}</td>
      </tr>
      {node.expanded &&
        Array.from(node.children.values())
          .sort((a, b) => b.totais.faturamento - a.totais.faturamento)
          .map((child) => <TreeRow key={child.label} node={child} onToggle={onToggle} />)}
    </>
  );
}

function MetricCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">{label}</p>
      <p className={`text-lg font-bold mt-1 tabular-nums ${accent || "text-slate-800"}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function formatChartTooltip(value: number, metrica: MetricaGrafico): string {
  if (metrica === "faturamento") return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (metrica === "margem") return value.toFixed(2) + "%";
  return value.toFixed(1) + " dias";
}

function formatYAxis(v: number, metrica: MetricaGrafico): string {
  if (metrica === "faturamento") {
    const n = Number(v);
    return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}K` : String(n);
  }
  if (metrica === "margem") return `${v}%`;
  return `${v}d`;
}

const METRICA_COLORS: Record<MetricaGrafico, string> = {
  faturamento: "#3b82f6",
  margem: "#10b981",
  tmr: "#f59e0b",
};

export default function FechamentoPage() {
  const [loading, setLoading] = useState(false);
  const [dadosAno, setDadosAno] = useState<DataRow[]>([]);
  const [dadosAnoAnterior, setDadosAnoAnterior] = useState<DataRow[]>([]);
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [inicializado, setInicializado] = useState(false);

  const currentYear = new Date().getFullYear();
  const [ano, setAno] = useState(currentYear);
  const [mesSelecionado, setMesSelecionado] = useState<number>(new Date().getMonth());
  const [consultoresSelecionados, setConsultoresSelecionados] = useState<string[]>([]);
  const [consultorDropdownOpen, setConsultorDropdownOpen] = useState(false);
  const [midiasSelecionadas, setMidiasSelecionadas] = useState<string[]>([]);
  const [midiaDropdownOpen, setMidiaDropdownOpen] = useState(false);
  const [pecaServicoSelecionados, setPecaServicoSelecionados] = useState<string[]>([]);
  const [pecaServicoDropdownOpen, setPecaServicoDropdownOpen] = useState(false);

  // Manual costs
  const [custosManuaisAno, setCustosManuaisAno] = useState<CustoManual[]>([]);
  const [custosManuaisAnoAnterior, setCustosManuaisAnoAnterior] = useState<CustoManual[]>([]);
  const [custosForm, setCustosForm] = useState<Record<string, CustoManual>>({});
  const [salvandoCustos, setSalvandoCustos] = useState(false);
  const [custosAberto, setCustosAberto] = useState(false);
  const [custosMensagem, setCustosMensagem] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);
  const [editandoCampo, setEditandoCampo] = useState<string | null>(null);
  const [editandoValor, setEditandoValor] = useState("");

  // Chart metric selector
  const [metricaGrafico, setMetricaGrafico] = useState<MetricaGrafico>("faturamento");

  // Calcular Variaveis
  const [calculandoVariaveis, setCalculandoVariaveis] = useState(false);

  // Initialize on mount
  useEffect(() => {
    setInicializado(true);
  }, []);

  // Fetch full year data + previous year + manual costs
  const fetchAno = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("dataInicio", `${ano}-01-01`);
      params.set("dataFim", `${ano}-12-31`);

      const paramsAnt = new URLSearchParams();
      paramsAnt.set("dataInicio", `${ano - 1}-01-01`);
      paramsAnt.set("dataFim", `${ano - 1}-12-31`);

      const [resAtual, resAnterior, resCustos, resCustosAnt] = await Promise.all([
        fetch(`/api/dados?${params.toString()}`),
        fetch(`/api/dados?${paramsAnt.toString()}`),
        fetch(`/api/custos-manuais?ano=${ano}`),
        fetch(`/api/custos-manuais?ano=${ano - 1}`),
      ]);

      const [jsonAtual, jsonAnterior, jsonCustos, jsonCustosAnt] = await Promise.all([
        resAtual.json(),
        resAnterior.json(),
        resCustos.json(),
        resCustosAnt.json(),
      ]);

      const CLIENTES_INTER = ["PEDROTTI IMPLEMENTOS RODOVIARIOS LTDA", "POSTO DE MOLAS PEDROTTI LTDA"];
      const excluir = (row: DataRow) => {
        // Excluir POSTO DE MOLAS inteiramente
        if ((row.filial || "").toUpperCase().includes("POSTO DE MOLAS")) return false;
        // Excluir servicos intercompany da Magalhaes
        if (
          (row.filial || "").toUpperCase().includes("MAGALH") &&
          (row.peca_ou_servico || "").toUpperCase().includes("SERVI") &&
          CLIENTES_INTER.includes((row.cliente || "").toUpperCase().trim())
        ) return false;
        return true;
      };
      setDadosAno((jsonAtual.data || []).filter(excluir));
      setDadosAnoAnterior((jsonAnterior.data || []).filter(excluir));

      const custos: CustoManual[] = jsonCustos.custos || [];
      setCustosManuaisAno(custos);
      setCustosManuaisAnoAnterior(jsonCustosAnt.custos || []);

      // Initialize form with existing data
      const formMap: Record<string, CustoManual> = {};
      for (const c of custos) {
        formMap[`${c.filial}_${c.mes}`] = { ...c };
      }

      // Auto-calculate variaveis for all 12 months
      try {
        const variaveisPromises = Array.from({ length: 12 }, (_, i) =>
          fetch(`/api/calcular-variaveis?ano=${ano}&mes=${i + 1}`).then((r) => r.json())
        );
        const variaveisResults = await Promise.all(variaveisPromises);
        for (let i = 0; i < 12; i++) {
          const resultado: Array<{ filial: string; custo_variaveis: number }> = variaveisResults[i]?.resultado || [];
          for (const r of resultado) {
            const key = `${r.filial}_${i + 1}`;
            if (!formMap[key]) {
              formMap[key] = { filial: r.filial, ano, mes: i + 1, custo_folha: 0, horas_extras: 0, custo_terceiros: 0, custo_variaveis: 0, consumiveis: 0 };
            }
            formMap[key] = { ...formMap[key], custo_variaveis: r.custo_variaveis };
          }
        }
      } catch {
        // ignore - variaveis calculation is optional
      }

      setCustosForm(formMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [ano]);

  useEffect(() => {
    if (inicializado) fetchAno();
  }, [fetchAno, inicializado]);

  // Get list of filiais from data
  const filiais = useMemo(() => {
    const set = new Set<string>();
    for (const row of dadosAno) {
      if (row.filial) set.add(row.filial);
    }
    return Array.from(set).sort();
  }, [dadosAno]);

  // All data for the selected month (all consultants) — used for variavelEncarregado and consultant availability
  const dadosMes = useMemo(() => {
    if (dadosAno.length === 0) return [];
    return dadosAno.filter((row) => {
      if (!row.data) return false;
      const d = new Date(row.data + "T00:00:00");
      return d.getMonth() === mesSelecionado;
    });
  }, [dadosAno, mesSelecionado]);

  // Only consultants with faturamento in the selected month
  const consultoresComFaturamento = useMemo(() => {
    const set = new Set<string>();
    for (const row of dadosMes) {
      if (row.consultor && (row.faturamento || 0) !== 0) {
        set.add(row.consultor);
      }
    }
    return Array.from(set).sort();
  }, [dadosMes]);

  // Clean up selected consultants when available list changes
  useEffect(() => {
    setConsultoresSelecionados((prev) => {
      const filtered = prev.filter((c) => consultoresComFaturamento.includes(c));
      return filtered.length !== prev.length ? filtered : prev;
    });
  }, [consultoresComFaturamento]);

  // Only tipo_midia with faturamento in the selected month
  const midiasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const row of dadosMes) {
      if (row.tipo_midia && (row.faturamento || 0) !== 0) {
        set.add(row.tipo_midia);
      }
    }
    return Array.from(set).sort();
  }, [dadosMes]);

  // Clean up selected midias when available list changes
  useEffect(() => {
    setMidiasSelecionadas((prev) => {
      const filtered = prev.filter((m) => midiasDisponiveis.includes(m));
      return filtered.length !== prev.length ? filtered : prev;
    });
  }, [midiasDisponiveis]);

  // Only peca_ou_servico with faturamento in the selected month
  const pecaServicoDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const row of dadosMes) {
      if (row.peca_ou_servico && (row.faturamento || 0) !== 0) {
        set.add(row.peca_ou_servico);
      }
    }
    return Array.from(set).sort();
  }, [dadosMes]);

  // Clean up selected peca/servico when available list changes
  useEffect(() => {
    setPecaServicoSelecionados((prev) => {
      const filtered = prev.filter((p) => pecaServicoDisponiveis.includes(p));
      return filtered.length !== prev.length ? filtered : prev;
    });
  }, [pecaServicoDisponiveis]);

  // Month + consultant + midia + peca/servico filtered data (for DRE, cards, variavelConsultor)
  const dadosFiltrados = useMemo(() => {
    let filtered = dadosMes;
    if (consultoresSelecionados.length > 0) {
      filtered = filtered.filter((row) => consultoresSelecionados.includes(row.consultor));
    }
    if (midiasSelecionadas.length > 0) {
      filtered = filtered.filter((row) => midiasSelecionadas.includes(row.tipo_midia));
    }
    if (pecaServicoSelecionados.length > 0) {
      filtered = filtered.filter((row) => pecaServicoSelecionados.includes(row.peca_ou_servico));
    }
    return filtered;
  }, [dadosMes, consultoresSelecionados, midiasSelecionadas, pecaServicoSelecionados]);

  // Variável do consultor: 2,5% do lucro de Peças (respects consultant filter)
  const variavelConsultor = useMemo(() => {
    let lucroPecas = 0;
    for (const row of dadosFiltrados) {
      const tipo = (row.peca_ou_servico || "").toUpperCase();
      if (tipo.includes("PE")) {
        lucroPecas += row.lucro_rs || 0;
      }
    }
    return Math.max(0, lucroPecas * 0.025);
  }, [dadosFiltrados]);

  // Variável do encarregado: 2% lucro Peças + 3% lucro Serviço Oficina (always total geral do mês)
  const variavelEncarregado = useMemo(() => {
    let lucroPecas = 0;
    let lucroServicoOficina = 0;
    for (const row of dadosMes) {
      const tipo = (row.peca_ou_servico || "").toUpperCase();
      if (tipo.includes("PE")) {
        lucroPecas += row.lucro_rs || 0;
      }
      if (tipo.includes("SERVI") && (row.balcao_ou_oficina || "").toUpperCase().includes("OFICINA")) {
        lucroServicoOficina += row.lucro_rs || 0;
      }
    }
    const mesAtual = mesSelecionado + 1;
    for (const cm of custosManuaisAno.filter((c) => c.mes === mesAtual)) {
      const manualTotal = (cm.custo_folha || 0) + (cm.horas_extras || 0) + (cm.custo_terceiros || 0) + (cm.custo_variaveis || 0) + (cm.consumiveis || 0);
      let oldCost = 0;
      for (const r of dadosMes) {
        if (r.filial === cm.filial && (r.peca_ou_servico || "").toUpperCase().includes("SERVI") && (r.balcao_ou_oficina || "").toUpperCase().includes("OFICINA") && (r.tipo_midia || "").toUpperCase().includes("OUTRO")) {
          oldCost += r.custo_total || 0;
        }
      }
      const delta = manualTotal - oldCost;
      lucroServicoOficina -= delta;
    }
    const comissaoPecasEncarregado = Math.max(0, lucroPecas * 0.02);
    const comissaoServicoEncarregado = Math.max(0, lucroServicoOficina * 0.03);
    return comissaoPecasEncarregado + comissaoServicoEncarregado;
  }, [dadosMes, custosManuaisAno, mesSelecionado]);

  // Build DRE tree with manual cost override
  useEffect(() => {
    if (dadosFiltrados.length > 0) {
      const t = buildTree(dadosFiltrados);
      const custosMes = custosManuaisAno.filter((c) => c.mes === mesSelecionado + 1);
      if (custosMes.length > 0) {
        applyManualCosts(t, custosManuaisAno, mesSelecionado + 1);
      }
      setTree(t);
    } else {
      setTree(null);
    }
  }, [dadosFiltrados, custosManuaisAno, mesSelecionado]);

  // Monthly aggregation for chart (all 12 months, with manual costs + previous year)
  const dadosMensais = useMemo<MesChartData[]>(() => {
    // Apply consultant + midia + peca/servico filter client-side
    function applyFilters(rows: DataRow[]): DataRow[] {
      let result = rows;
      if (consultoresSelecionados.length > 0) {
        result = result.filter((r) => consultoresSelecionados.includes(r.consultor));
      }
      if (midiasSelecionadas.length > 0) {
        result = result.filter((r) => midiasSelecionadas.includes(r.tipo_midia));
      }
      if (pecaServicoSelecionados.length > 0) {
        result = result.filter((r) => pecaServicoSelecionados.includes(r.peca_ou_servico));
      }
      return result;
    }
    const dadosAnoFiltrado = applyFilters(dadosAno);
    const dadosAntFiltrado = applyFilters(dadosAnoAnterior);

    // Current year: group by month
    const porMes = new Map<number, DataRow[]>();
    for (const row of dadosAnoFiltrado) {
      if (!row.data) continue;
      const d = new Date(row.data + "T00:00:00");
      const mesIdx = d.getMonth();
      if (!porMes.has(mesIdx)) porMes.set(mesIdx, []);
      porMes.get(mesIdx)!.push(row);
    }

    // Previous year: group by month
    const porMesAnt = new Map<number, DataRow[]>();
    for (const row of dadosAntFiltrado) {
      if (!row.data) continue;
      const d = new Date(row.data + "T00:00:00");
      const mesIdx = d.getMonth();
      if (!porMesAnt.has(mesIdx)) porMesAnt.set(mesIdx, []);
      porMesAnt.get(mesIdx)!.push(row);
    }

    function calcMetric(rows: DataRow[], allYearRows: DataRow[], mesIdx: number, metrica: MetricaGrafico, custosM: CustoManual[]): number {
      let fat = 0, vendaLiq = 0, lucro = 0;
      const regs: Array<{ condicao_pagamento: string | null; faturamento: number }> = [];
      for (const r of rows) {
        fat += r.faturamento || 0;
        vendaLiq += r.venda_liquida || 0;
        lucro += r.lucro_rs || 0;
        regs.push({ condicao_pagamento: r.condicao_pagamento, faturamento: r.faturamento || 0 });
      }

      if (metrica === "faturamento") return Math.round(fat * 100) / 100;
      if (metrica === "tmr") return rows.length > 0 ? Math.round(calcularTMR(regs) * 100) / 100 : 0;

      // Margem: apply manual cost delta only if data includes service rows
      // (manual costs are for Servico Oficina, not Pecas)
      const hasServices = rows.some((r) => (r.peca_ou_servico || "").toUpperCase().includes("SERVI"));
      const delta = hasServices ? computeCostDelta(allYearRows, custosM, mesIdx + 1) : 0;
      const adjustedLucro = lucro - delta;
      const margem = vendaLiq !== 0 ? (adjustedLucro / vendaLiq) * 100 : 0;
      return Math.round(margem * 100) / 100;
    }

    const result: MesChartData[] = [];
    for (let i = 0; i < 12; i++) {
      const rowsAtual = porMes.get(i) || [];
      const rowsAnt = porMesAnt.get(i) || [];
      result.push({
        mes: MESES[i],
        mesIdx: i,
        atual: calcMetric(rowsAtual, dadosAnoFiltrado, i, metricaGrafico, custosManuaisAno),
        anterior: calcMetric(rowsAnt, dadosAntFiltrado, i, metricaGrafico, custosManuaisAnoAnterior),
        selecionado: i === mesSelecionado,
      });
    }

    return result;
  }, [dadosAno, dadosAnoAnterior, mesSelecionado, metricaGrafico, custosManuaisAno, custosManuaisAnoAnterior, consultoresSelecionados, midiasSelecionadas, pecaServicoSelecionados]);

  function toggleNode(target: TreeNode) {
    target.expanded = !target.expanded;
    setTree((prev) => (prev ? { ...prev } : null));
  }

  function selecionarMes(idx: number) {
    setMesSelecionado(idx);
  }

  function toggleConsultor(consultor: string) {
    setConsultoresSelecionados((prev) =>
      prev.includes(consultor) ? prev.filter((c) => c !== consultor) : [...prev, consultor]
    );
  }

  function toggleMidia(midia: string) {
    setMidiasSelecionadas((prev) =>
      prev.includes(midia) ? prev.filter((m) => m !== midia) : [...prev, midia]
    );
  }

  function togglePecaServico(ps: string) {
    setPecaServicoSelecionados((prev) =>
      prev.includes(ps) ? prev.filter((p) => p !== ps) : [...prev, ps]
    );
  }

  // Manual costs form helpers
  function getCustoForm(filial: string): CustoManual {
    const key = `${filial}_${mesSelecionado + 1}`;
    return custosForm[key] || { filial, ano, mes: mesSelecionado + 1, custo_folha: 0, horas_extras: 0, custo_terceiros: 0, custo_variaveis: 0, consumiveis: 0 };
  }

  function updateCustoField(filial: string, field: keyof CustoManual, value: number) {
    const key = `${filial}_${mesSelecionado + 1}`;
    const existing = getCustoForm(filial);
    setCustosForm((prev) => ({
      ...prev,
      [key]: { ...existing, filial, ano, mes: mesSelecionado + 1, [field]: value },
    }));
  }

  async function salvarCustos() {
    setSalvandoCustos(true);
    setCustosMensagem(null);
    try {
      const responses = await Promise.all(
        filiais.map(async (filial) => {
          const custo = getCustoForm(filial);
          const res = await fetch("/api/custos-manuais", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...custo, filial, ano, mes: mesSelecionado + 1 }),
          });
          const json = await res.json();
          if (!res.ok) {
            return { filial, error: json.error || `HTTP ${res.status}` };
          }
          return { filial, error: null };
        })
      );

      const erros = responses.filter((r) => r.error);
      if (erros.length > 0) {
        setCustosMensagem({ tipo: "erro", texto: erros.map((e) => `${e.filial}: ${e.error}`).join("; ") });
        return;
      }

      // Refresh manual costs
      const res = await fetch(`/api/custos-manuais?ano=${ano}`);
      const json = await res.json();
      const custos: CustoManual[] = json.custos || [];
      setCustosManuaisAno(custos);
      const formMap: Record<string, CustoManual> = {};
      for (const c of custos) formMap[`${c.filial}_${c.mes}`] = { ...c };
      setCustosForm(formMap);
      setCustosMensagem({ tipo: "sucesso", texto: "Custos salvos com sucesso" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setCustosMensagem({ tipo: "erro", texto: msg });
    } finally {
      setSalvandoCustos(false);
    }
  }

  async function calcularVariaveis() {
    setCalculandoVariaveis(true);
    setCustosMensagem(null);
    try {
      const res = await fetch(`/api/calcular-variaveis?ano=${ano}&mes=${mesSelecionado + 1}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      const resultado: Array<{ filial: string; custo_variaveis: number }> = json.resultado || [];
      for (const r of resultado) {
        updateCustoField(r.filial, "custo_variaveis", r.custo_variaveis);
      }
      setCustosMensagem({
        tipo: "sucesso",
        texto: `Variaveis calculadas para ${resultado.length} filial(is). Salve para confirmar.`,
      });
    } catch (err) {
      setCustosMensagem({ tipo: "erro", texto: err instanceof Error ? err.message : "Erro ao calcular" });
    } finally {
      setCalculandoVariaveis(false);
    }
  }

  const periodoLabel = `${MESES[mesSelecionado]}/${ano}`;
  const totaisGeral = tree?.totais;
  const hasAnyData = dadosAno.length > 0;
  const color = METRICA_COLORS[metricaGrafico];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">Fechamento do Periodo</h1>
        <p className="text-sm text-slate-400 mt-1">Analise DRE por filial, tipo, canal e midia</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        {/* Year selector */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Ano</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setAno((y) => y - 1)}
              className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-sm font-semibold text-slate-700 w-14 text-center tabular-nums">{ano}</span>
            <button
              onClick={() => setAno((y) => y + 1)}
              className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
          {loading && (
            <div className="flex items-center gap-2 ml-3">
              <svg className="animate-spin h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-xs text-slate-400">Carregando...</span>
            </div>
          )}
        </div>

        {/* Month selector grid */}
        <div className="mb-4">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide block mb-2">Mes</span>
          <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
            {MESES.map((mes, idx) => {
              const selected = idx === mesSelecionado;
              return (
                <button
                  key={mes}
                  onClick={() => selecionarMes(idx)}
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

        {/* Consultor + period label */}
        <div className="flex flex-wrap items-end gap-3 pt-3 border-t border-slate-100">
          <div className="relative">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide block mb-1.5">Consultor</span>
            <button
              type="button"
              onClick={() => setConsultorDropdownOpen(!consultorDropdownOpen)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white min-w-[220px] text-left flex items-center justify-between hover:border-slate-300 transition-colors"
            >
              <span className="truncate text-slate-600">
                {consultoresSelecionados.length === 0
                  ? "Todos os consultores"
                  : consultoresSelecionados.length === 1
                    ? consultoresSelecionados[0]
                    : `${consultoresSelecionados.length} selecionados`}
              </span>
              <svg className="w-4 h-4 ml-2 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {consultorDropdownOpen && (
              <div className="absolute z-50 mt-1 w-72 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-auto">
                <div className="sticky top-0 bg-white border-b border-slate-100 p-2.5 flex gap-3">
                  <button onClick={() => setConsultoresSelecionados([...consultoresComFaturamento])} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                    Selecionar todos
                  </button>
                  <button onClick={() => setConsultoresSelecionados([])} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                    Limpar
                  </button>
                </div>
                {consultoresComFaturamento.map((consultor) => (
                  <label key={consultor} className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={consultoresSelecionados.includes(consultor)}
                      onChange={() => toggleConsultor(consultor)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="truncate text-slate-600">{consultor}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide block mb-1.5">Tipo Midia</span>
            <button
              type="button"
              onClick={() => setMidiaDropdownOpen(!midiaDropdownOpen)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white min-w-[220px] text-left flex items-center justify-between hover:border-slate-300 transition-colors"
            >
              <span className="truncate text-slate-600">
                {midiasSelecionadas.length === 0
                  ? "Todos os tipos"
                  : midiasSelecionadas.length === 1
                    ? midiasSelecionadas[0]
                    : `${midiasSelecionadas.length} selecionados`}
              </span>
              <svg className="w-4 h-4 ml-2 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {midiaDropdownOpen && (
              <div className="absolute z-50 mt-1 w-72 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-auto">
                <div className="sticky top-0 bg-white border-b border-slate-100 p-2.5 flex gap-3">
                  <button onClick={() => setMidiasSelecionadas([...midiasDisponiveis])} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                    Selecionar todos
                  </button>
                  <button onClick={() => setMidiasSelecionadas([])} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                    Limpar
                  </button>
                </div>
                {midiasDisponiveis.map((midia) => (
                  <label key={midia} className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={midiasSelecionadas.includes(midia)}
                      onChange={() => toggleMidia(midia)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="truncate text-slate-600">{midia}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide block mb-1.5">Peca / Servico</span>
            <button
              type="button"
              onClick={() => setPecaServicoDropdownOpen(!pecaServicoDropdownOpen)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white min-w-[220px] text-left flex items-center justify-between hover:border-slate-300 transition-colors"
            >
              <span className="truncate text-slate-600">
                {pecaServicoSelecionados.length === 0
                  ? "Todos"
                  : pecaServicoSelecionados.length === 1
                    ? pecaServicoSelecionados[0]
                    : `${pecaServicoSelecionados.length} selecionados`}
              </span>
              <svg className="w-4 h-4 ml-2 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {pecaServicoDropdownOpen && (
              <div className="absolute z-50 mt-1 w-72 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-auto">
                <div className="sticky top-0 bg-white border-b border-slate-100 p-2.5 flex gap-3">
                  <button onClick={() => setPecaServicoSelecionados([...pecaServicoDisponiveis])} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                    Selecionar todos
                  </button>
                  <button onClick={() => setPecaServicoSelecionados([])} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                    Limpar
                  </button>
                </div>
                {pecaServicoDisponiveis.map((ps) => (
                  <label key={ps} className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={pecaServicoSelecionados.includes(ps)}
                      onChange={() => togglePecaServico(ps)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="truncate text-slate-600">{ps}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {periodoLabel && (
            <span className="text-xs text-slate-400 ml-auto self-center">
              Periodo: <span className="font-medium text-slate-600">{periodoLabel}</span>
            </span>
          )}
        </div>
      </div>

      {(consultorDropdownOpen || midiaDropdownOpen || pecaServicoDropdownOpen) && (
        <div className="fixed inset-0 z-40" onClick={() => { setConsultorDropdownOpen(false); setMidiaDropdownOpen(false); setPecaServicoDropdownOpen(false); }} />
      )}

      {/* Metric Cards */}
      {totaisGeral && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          <MetricCard label="Faturamento" value={formatBRL(totaisGeral.faturamento)} />
          <MetricCard
            label="Margem"
            value={formatPct(totaisGeral.margem)}
            accent={totaisGeral.margem < 0 ? "text-red-600" : "text-emerald-600"}
          />
          <MetricCard label="TMR" value={formatDias(totaisGeral.tmr)} sub="prazo medio recebimento" />
          <MetricCard
            label="Var. Consultor"
            value={formatBRL(variavelConsultor)}
            sub="2,5% lucro pecas"
            accent={variavelConsultor < 0 ? "text-red-600" : "text-blue-600"}
          />
          <MetricCard
            label="Var. Encarregado"
            value={formatBRL(variavelEncarregado)}
            sub="2% pecas + 3% serv. oficina"
            accent={variavelEncarregado < 0 ? "text-red-600" : "text-blue-600"}
          />
        </div>
      )}

      {/* Chart - single chart with metric selector */}
      {hasAnyData && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-1">
              {(Object.keys(METRICA_LABELS) as MetricaGrafico[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMetricaGrafico(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    metricaGrafico === m
                      ? "text-white shadow-sm"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                  style={metricaGrafico === m ? { backgroundColor: METRICA_COLORS[m] } : undefined}
                >
                  {METRICA_LABELS[m]}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-slate-400">{ano} vs {ano - 1}</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dadosMensais} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickFormatter={(v) => formatYAxis(Number(v), metricaGrafico)}
              />
              <Tooltip
                formatter={(value, name) => [
                  formatChartTooltip(Number(value), metricaGrafico),
                  name === "atual" ? `${ano}` : `${ano - 1}`,
                ]}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
              />
              <Legend
                formatter={(value) => (value === "atual" ? `${ano}` : `${ano - 1}`)}
                wrapperStyle={{ fontSize: 11 }}
              />
              <Bar dataKey="anterior" radius={[4, 4, 0, 0]} fill="#e2e8f0" name="anterior" />
              <Bar dataKey="atual" radius={[4, 4, 0, 0]} name="atual">
                {dadosMensais.map((entry) => (
                  <Cell
                    key={entry.mes}
                    fill={entry.selecionado ? color : color}
                    opacity={entry.selecionado ? 1 : 0.4}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* DRE Table */}
      {tree && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              {dadosFiltrados.length.toLocaleString("pt-BR")} registros &middot; {periodoLabel}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-100">
                  <th className="px-3 py-2.5 text-left font-semibold min-w-[280px]">Descricao</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Faturamento</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Impostos</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Venda Liq.</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Custo Total</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Lucro R$</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Margem %</th>
                  <th className="px-3 py-2.5 text-right font-semibold">TMR*</th>
                </tr>
              </thead>
              <tbody>
                <TreeRow node={tree} onToggle={toggleNode} />
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 border-t border-slate-100">
            <p className="text-[11px] text-slate-400">
              * TMR: prazo medio ponderado pelo faturamento. PIX, Dinheiro, Cartao, OP, Sem condicao = 0 dias.
              Boletos = media das parcelas. &quot;Carteira&quot; ignorada.
            </p>
          </div>
        </div>
      )}

      {/* Manual Costs Section - below DRE */}
      {hasAnyData && filiais.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 mt-6">
          <button
            onClick={() => setCustosAberto(!custosAberto)}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50/50 transition-colors"
          >
            <div>
              <p className="text-sm font-semibold text-slate-700">Custos Oficina</p>
              <p className="text-[11px] text-slate-400">Servico &gt; Oficina &gt; Outros &middot; {periodoLabel}</p>
            </div>
            <svg className={`w-4 h-4 text-slate-400 transition-transform ${custosAberto ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {custosAberto && (
            <div className="border-t border-slate-100 p-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] text-slate-400 uppercase tracking-wider">
                      <th className="px-2 py-2 text-left font-semibold">Filial</th>
                      <th className="px-2 py-2 text-right font-semibold">Folha</th>
                      <th className="px-2 py-2 text-right font-semibold">Horas Extras</th>
                      <th className="px-2 py-2 text-right font-semibold">Terceiros</th>
                      <th className="px-2 py-2 text-right font-semibold">Variaveis</th>
                      <th className="px-2 py-2 text-right font-semibold">Consumiveis</th>
                      <th className="px-2 py-2 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filiais.map((filial) => {
                      const c = getCustoForm(filial);
                      const total = (c.custo_folha || 0) + (c.horas_extras || 0) + (c.custo_terceiros || 0) + (c.custo_variaveis || 0) + (c.consumiveis || 0);
                      return (
                        <tr key={filial} className="border-t border-slate-50">
                          <td className="px-2 py-2 text-slate-700 font-medium text-[13px]">{filial}</td>
                          {(["custo_folha", "horas_extras", "custo_terceiros", "custo_variaveis", "consumiveis"] as const).map((field) => {
                            const campoKey = `${filial}_${field}`;
                            const isEditing = editandoCampo === campoKey;
                            const rawVal = c[field] || 0;
                            const displayValue = isEditing
                              ? editandoValor
                              : rawVal ? rawVal.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "";
                            return (
                              <td key={field} className="px-2 py-1.5">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={displayValue}
                                  onFocus={() => {
                                    setEditandoCampo(campoKey);
                                    setEditandoValor(rawVal ? String(rawVal).replace(".", ",") : "");
                                  }}
                                  onBlur={() => setEditandoCampo(null)}
                                  onChange={(e) => {
                                    setEditandoValor(e.target.value);
                                    const parsed = parseFloat(e.target.value.replace(/\./g, "").replace(",", ".")) || 0;
                                    updateCustoField(filial, field, parsed);
                                  }}
                                  className="w-full text-right text-[13px] tabular-nums border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="0,00"
                                />
                              </td>
                            );
                          })}
                          <td className="px-2 py-2 text-right text-[13px] tabular-nums font-medium text-slate-600">
                            {formatBRL(total)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {custosMensagem && (
                <div className={`mt-3 rounded-lg px-3 py-2 text-sm ${custosMensagem.tipo === "sucesso" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                  {custosMensagem.texto}
                </div>
              )}
              <div className="mt-3 flex justify-end gap-2">
                <button
                  onClick={calcularVariaveis}
                  disabled={calculandoVariaveis}
                  className="border border-blue-200 text-blue-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 transition-colors"
                >
                  {calculandoVariaveis ? "Calculando..." : "Calcular Variaveis"}
                </button>
                <button
                  onClick={salvarCustos}
                  disabled={salvandoCustos}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
                >
                  {salvandoCustos ? "Salvando..." : "Salvar Custos"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!tree && !loading && (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-sm text-slate-500">Selecione um mes para ver os dados</p>
        </div>
      )}
    </div>
  );
}
