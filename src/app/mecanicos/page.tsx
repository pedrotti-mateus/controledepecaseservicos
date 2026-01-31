"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

interface ComissaoMecanico {
  id: number;
  mecanico: string;
  ano: number;
  mes: number;
  valor_servicos: number;
  comissao_total: number;
  percentual_comissao: number;
  num_ordens: number;
}

type MetricaMecanico = "faturamento" | "comissao";

interface MesChartData {
  mes: string;
  mesIdx: number;
  atual: number;
  anterior: number;
  selecionado: boolean;
}

const MESES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const METRICA_LABELS: Record<MetricaMecanico, string> = {
  faturamento: "Faturamento",
  comissao: "Comissao",
};

const METRICA_COLORS: Record<MetricaMecanico, string> = {
  faturamento: "#3b82f6",
  comissao: "#10b981",
};

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

function formatPct(value: number): string {
  return value.toFixed(2) + "%";
}

function formatYAxis(v: number): string {
  const n = Number(v);
  return n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
      ? `${(n / 1_000).toFixed(0)}K`
      : String(n);
}

function MetricCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">
        {label}
      </p>
      <p
        className={`text-lg font-bold mt-1 tabular-nums ${accent || "text-slate-800"}`}
      >
        {value}
      </p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function MecanicosPage() {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [mesSelecionado, setMesSelecionado] = useState(new Date().getMonth());
  const [dadosAno, setDadosAno] = useState<ComissaoMecanico[]>([]);
  const [dadosAnoAnterior, setDadosAnoAnterior] = useState<ComissaoMecanico[]>([]);
  const [loading, setLoading] = useState(false);

  // Mechanic filter
  const [mecanicosSelecionados, setMecanicosSelecionados] = useState<string[]>([]);
  const [mecanicoDropdownOpen, setMecanicoDropdownOpen] = useState(false);

  // Comissionado filter
  const [filtroComissionado, setFiltroComissionado] = useState<"todos" | "comissionados" | "nao_comissionados">("todos");
  const [mecanicosComissionados, setMecanicosComissionados] = useState<Set<string>>(new Set());

  // Chart metric
  const [metricaGrafico, setMetricaGrafico] = useState<MetricaMecanico>("faturamento");

  // Fetch full year + previous year + cadastro
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [resAtual, resAnterior, resCadastro] = await Promise.all([
        fetch(`/api/mecanicos?ano=${ano}`),
        fetch(`/api/mecanicos?ano=${ano - 1}`),
        fetch("/api/cadastro-mecanicos"),
      ]);
      const [jsonAtual, jsonAnterior, jsonCadastro] = await Promise.all([
        resAtual.json(),
        resAnterior.json(),
        resCadastro.json(),
      ]);
      setDadosAno(jsonAtual.data || []);
      setDadosAnoAnterior(jsonAnterior.data || []);

      const comissionados = new Set<string>();
      for (const c of jsonCadastro.cadastrados || []) {
        if (c.comissionado) comissionados.add(c.mecanico);
      }
      setMecanicosComissionados(comissionados);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [ano]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Data for the selected month (all mechanics)
  const dadosMes = useMemo(() => {
    return dadosAno.filter((d) => d.mes === mesSelecionado + 1);
  }, [dadosAno, mesSelecionado]);

  // Available mechanics in the selected month (with faturamento)
  const mecanicosDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const d of dadosMes) {
      if (d.mecanico && (d.valor_servicos || 0) > 0) {
        set.add(d.mecanico);
      }
    }
    return Array.from(set).sort();
  }, [dadosMes]);

  // Clean up selected mechanics when available list changes
  useEffect(() => {
    setMecanicosSelecionados((prev) => {
      const filtered = prev.filter((m) => mecanicosDisponiveis.includes(m));
      return filtered.length !== prev.length ? filtered : prev;
    });
  }, [mecanicosDisponiveis]);

  // Filtered data for table and cards (selected month + mechanic filter + comissionado filter)
  const dadosFiltrados = useMemo(() => {
    let filtered = dadosMes;
    if (mecanicosSelecionados.length > 0) {
      filtered = filtered.filter((d) => mecanicosSelecionados.includes(d.mecanico));
    }
    if (filtroComissionado === "comissionados") {
      filtered = filtered.filter((d) => mecanicosComissionados.has(d.mecanico));
    } else if (filtroComissionado === "nao_comissionados") {
      filtered = filtered.filter((d) => !mecanicosComissionados.has(d.mecanico));
    }
    return filtered;
  }, [dadosMes, mecanicosSelecionados, filtroComissionado, mecanicosComissionados]);

  // Computed totals for the filtered month data
  const totais = useMemo(() => {
    let valorServicos = 0;
    let comissaoTotal = 0;
    let numOrdens = 0;
    for (const d of dadosFiltrados) {
      valorServicos += d.valor_servicos || 0;
      comissaoTotal += d.comissao_total || 0;
      numOrdens += d.num_ordens || 0;
    }
    const pctMedio =
      valorServicos > 0 ? (comissaoTotal / valorServicos) * 100 : 0;
    return { valorServicos, comissaoTotal, numOrdens, pctMedio };
  }, [dadosFiltrados]);

  // Monthly chart data (Jan-Dec, current vs previous year)
  const dadosMensais = useMemo<MesChartData[]>(() => {
    function passesFilters(d: ComissaoMecanico): boolean {
      if (mecanicosSelecionados.length > 0 && !mecanicosSelecionados.includes(d.mecanico)) return false;
      if (filtroComissionado === "comissionados" && !mecanicosComissionados.has(d.mecanico)) return false;
      if (filtroComissionado === "nao_comissionados" && mecanicosComissionados.has(d.mecanico)) return false;
      return true;
    }

    function aggregate(data: ComissaoMecanico[], mesNum: number, metrica: MetricaMecanico): number {
      let total = 0;
      for (const d of data) {
        if (d.mes !== mesNum) continue;
        if (!passesFilters(d)) continue;
        total += metrica === "faturamento" ? (d.valor_servicos || 0) : (d.comissao_total || 0);
      }
      return Math.round(total * 100) / 100;
    }

    const result: MesChartData[] = [];
    for (let i = 0; i < 12; i++) {
      result.push({
        mes: MESES[i],
        mesIdx: i,
        atual: aggregate(dadosAno, i + 1, metricaGrafico),
        anterior: aggregate(dadosAnoAnterior, i + 1, metricaGrafico),
        selecionado: i === mesSelecionado,
      });
    }
    return result;
  }, [dadosAno, dadosAnoAnterior, mesSelecionado, metricaGrafico, mecanicosSelecionados, filtroComissionado, mecanicosComissionados]);

  const hasAnyData = dadosAno.length > 0;
  const periodoLabel = `${MESES[mesSelecionado]}/${ano}`;
  const color = METRICA_COLORS[metricaGrafico];

  function toggleMecanico(mecanico: string) {
    setMecanicosSelecionados((prev) =>
      prev.includes(mecanico) ? prev.filter((m) => m !== mecanico) : [...prev, mecanico]
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">Mecanicos</h1>
        <p className="text-sm text-slate-400 mt-1">
          Comissoes dos mecanicos por periodo
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        {/* Year selector */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">
            Ano
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setAno((y) => y - 1)}
              className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <span className="text-sm font-semibold text-slate-700 w-14 text-center tabular-nums">
              {ano}
            </span>
            <button
              onClick={() => setAno((y) => y + 1)}
              className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
          {loading && (
            <div className="flex items-center gap-2 ml-3">
              <svg
                className="animate-spin h-4 w-4 text-blue-500"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span className="text-xs text-slate-400">Carregando...</span>
            </div>
          )}
        </div>

        {/* Month selector grid */}
        <div className="mb-4">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide block mb-2">
            Mes
          </span>
          <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
            {MESES.map((mes, idx) => {
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

        {/* Mechanic filter + period label */}
        <div className="flex flex-wrap items-end gap-3 pt-3 border-t border-slate-100">
          <div className="relative">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide block mb-1.5">
              Mecanico
            </span>
            <button
              type="button"
              onClick={() => setMecanicoDropdownOpen(!mecanicoDropdownOpen)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white min-w-[220px] text-left flex items-center justify-between hover:border-slate-300 transition-colors"
            >
              <span className="truncate text-slate-600">
                {mecanicosSelecionados.length === 0
                  ? "Todos os mecanicos"
                  : mecanicosSelecionados.length === 1
                    ? mecanicosSelecionados[0]
                    : `${mecanicosSelecionados.length} selecionados`}
              </span>
              <svg
                className="w-4 h-4 ml-2 text-slate-400 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {mecanicoDropdownOpen && (
              <div className="absolute z-50 mt-1 w-72 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-auto">
                <div className="sticky top-0 bg-white border-b border-slate-100 p-2.5 flex gap-3">
                  <button
                    onClick={() => setMecanicosSelecionados([...mecanicosDisponiveis])}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Selecionar todos
                  </button>
                  <button
                    onClick={() => setMecanicosSelecionados([])}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Limpar
                  </button>
                </div>
                {mecanicosDisponiveis.map((mecanico) => (
                  <label
                    key={mecanico}
                    className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={mecanicosSelecionados.includes(mecanico)}
                      onChange={() => toggleMecanico(mecanico)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="truncate text-slate-600">{mecanico}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide block mb-1.5">
              Tipo
            </span>
            <select
              value={filtroComissionado}
              onChange={(e) => setFiltroComissionado(e.target.value as "todos" | "comissionados" | "nao_comissionados")}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white min-w-[180px] text-slate-600 hover:border-slate-300 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="todos">Todos</option>
              <option value="comissionados">Comissionados</option>
              <option value="nao_comissionados">Nao comissionados</option>
            </select>
          </div>

          <span className="text-xs text-slate-400 ml-auto self-center">
            Periodo:{" "}
            <span className="font-medium text-slate-600">{periodoLabel}</span>
          </span>
        </div>
      </div>

      {mecanicoDropdownOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setMecanicoDropdownOpen(false)}
        />
      )}

      {/* Summary cards */}
      {dadosFiltrados.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <MetricCard
            label="Faturamento"
            value={formatBRL(totais.valorServicos)}
          />
          <MetricCard
            label="Comissao Total"
            value={formatBRL(totais.comissaoTotal)}
            accent="text-blue-600"
          />
          <MetricCard
            label="Mecanicos"
            value={String(dadosFiltrados.length)}
          />
          <MetricCard
            label="Ordens de Servico"
            value={String(totais.numOrdens)}
          />
        </div>
      )}

      {/* Chart */}
      {hasAnyData && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-1">
              {(Object.keys(METRICA_LABELS) as MetricaMecanico[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMetricaGrafico(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    metricaGrafico === m
                      ? "text-white shadow-sm"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                  style={
                    metricaGrafico === m
                      ? { backgroundColor: METRICA_COLORS[m] }
                      : undefined
                  }
                >
                  {METRICA_LABELS[m]}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-slate-400">
              {ano} vs {ano - 1}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={dadosMensais}
              margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickFormatter={formatYAxis}
              />
              <Tooltip
                formatter={(value, name) => [
                  formatBRL(Number(value)),
                  name === "atual" ? `${ano}` : `${ano - 1}`,
                ]}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                }}
              />
              <Legend
                formatter={(value) =>
                  value === "atual" ? `${ano}` : `${ano - 1}`
                }
                wrapperStyle={{ fontSize: 11 }}
              />
              <Bar
                dataKey="anterior"
                radius={[4, 4, 0, 0]}
                fill="#e2e8f0"
                name="anterior"
              />
              <Bar dataKey="atual" radius={[4, 4, 0, 0]} name="atual">
                {dadosMensais.map((entry) => (
                  <Cell
                    key={entry.mes}
                    fill={color}
                    opacity={entry.selecionado ? 1 : 0.4}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Data table */}
      {dadosFiltrados.length > 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-xs text-slate-400">
              {dadosFiltrados.length} mecanicos &middot; {periodoLabel}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-100">
                  <th className="px-3 py-2.5 text-left font-semibold min-w-[240px]">
                    Mecanico
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    Ordens
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    Faturamento
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    % Comissao
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    Comissao Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {dadosFiltrados.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-3 py-2.5 text-[13px] text-slate-700 font-medium">
                      {d.mecanico}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[13px] tabular-nums text-slate-600">
                      {d.num_ordens}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[13px] tabular-nums text-slate-600">
                      {formatBRL(d.valor_servicos)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[13px] tabular-nums text-slate-600">
                      {formatPct(d.percentual_comissao)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[13px] tabular-nums text-slate-700 font-medium">
                      {formatBRL(d.comissao_total)}
                    </td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr className="bg-slate-800 text-white font-bold">
                  <td className="px-3 py-2.5 text-[13px]">Total</td>
                  <td className="px-3 py-2.5 text-right text-[13px] tabular-nums">
                    {totais.numOrdens}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[13px] tabular-nums">
                    {formatBRL(totais.valorServicos)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[13px] tabular-nums">
                    {formatPct(totais.pctMedio)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[13px] tabular-nums">
                    {formatBRL(totais.comissaoTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : !loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-6 h-6 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <p className="text-sm text-slate-500">
            Nenhum dado para {periodoLabel}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Importe o PDF do relatorio de comissoes acima
          </p>
        </div>
      ) : null}
    </div>
  );
}
