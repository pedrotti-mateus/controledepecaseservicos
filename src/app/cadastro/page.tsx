"use client";

import { useCallback, useEffect, useState } from "react";

interface CadastroMecanico {
  id?: number;
  mecanico: string;
  filial: string | null;
  salario_fixo: number;
  comissionado: boolean;
  isNew?: boolean; // from comissoes_mecanicos but not yet in cadastro
}

export default function CadastroPage() {
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);
  const [mecanicos, setMecanicos] = useState<CadastroMecanico[]>([]);
  const [filiais, setFiliais] = useState<string[]>([]);
  const [editandoCampo, setEditandoCampo] = useState<string | null>(null);
  const [editandoValor, setEditandoValor] = useState("");
  const [novoNome, setNovoNome] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cadastro-mecanicos");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      const cadastrados: CadastroMecanico[] = (json.cadastrados || []).map(
        (c: CadastroMecanico) => ({ ...c, isNew: false })
      );
      const naoCadastrados: CadastroMecanico[] = (json.nao_cadastrados || []).map(
        (nome: string) => ({
          mecanico: nome,
          filial: null,
          salario_fixo: 0,
          comissionado: false,
          isNew: true,
        })
      );
      setMecanicos([...cadastrados, ...naoCadastrados]);
      setFiliais(json.filiais || []);
    } catch (err) {
      console.error(err);
      setMensagem({ tipo: "erro", texto: err instanceof Error ? err.message : "Erro ao carregar dados" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function updateField(mecanico: string, field: keyof CadastroMecanico, value: unknown) {
    setMecanicos((prev) =>
      prev.map((m) => (m.mecanico === mecanico ? { ...m, [field]: value } : m))
    );
  }

  function adicionarMecanico() {
    const nome = novoNome.trim();
    if (!nome) return;
    if (mecanicos.some((m) => m.mecanico.toLowerCase() === nome.toLowerCase())) {
      setMensagem({ tipo: "erro", texto: `Mecanico "${nome}" ja existe na lista` });
      return;
    }
    setMecanicos((prev) => [
      ...prev,
      { mecanico: nome, filial: null, salario_fixo: 0, comissionado: false, isNew: true },
    ]);
    setNovoNome("");
    setMensagem(null);
  }

  async function salvarTodos() {
    setSalvando(true);
    setMensagem(null);
    try {
      const results = await Promise.all(
        mecanicos.map(async (m) => {
          const res = await fetch("/api/cadastro-mecanicos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mecanico: m.mecanico,
              filial: m.filial,
              salario_fixo: m.salario_fixo,
              comissionado: m.comissionado,
            }),
          });
          const json = await res.json();
          if (!res.ok) return { mecanico: m.mecanico, error: json.error };
          return { mecanico: m.mecanico, error: null };
        })
      );

      const erros = results.filter((r) => r.error);
      if (erros.length > 0) {
        setMensagem({
          tipo: "erro",
          texto: erros.map((e) => `${e.mecanico}: ${e.error}`).join("; "),
        });
      } else {
        setMensagem({ tipo: "sucesso", texto: `${results.length} mecanicos salvos com sucesso` });
        await fetchData();
      }
    } catch (err) {
      setMensagem({ tipo: "erro", texto: err instanceof Error ? err.message : "Erro ao salvar" });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">Cadastro de Mecanicos</h1>
        <p className="text-sm text-slate-400 mt-1">
          Registre salario fixo e flag de comissionado para calculo automatico de custos variaveis
        </p>
      </div>

      {/* Add mechanic manually */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wide block mb-1.5">
              Adicionar Mecanico
            </label>
            <input
              type="text"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && adicionarMecanico()}
              placeholder="Nome do mecanico"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={adicionarMecanico}
            className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
          >
            Adicionar
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <svg className="animate-spin h-6 w-6 text-blue-500 mx-auto mb-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm text-slate-400">Carregando...</p>
          </div>
        ) : mecanicos.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-slate-500">Nenhum mecanico encontrado. Adicione manualmente ou faca upload de comissoes.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    <th className="px-3 py-2.5 text-left font-semibold min-w-[200px]">Mecanico</th>
                    <th className="px-3 py-2.5 text-left font-semibold min-w-[180px]">Filial</th>
                    <th className="px-3 py-2.5 text-right font-semibold min-w-[140px]">Salario Fixo</th>
                    <th className="px-3 py-2.5 text-center font-semibold min-w-[120px]">Comissionado</th>
                  </tr>
                </thead>
                <tbody>
                  {mecanicos.map((m) => {
                    const campoKey = `salario_${m.mecanico}`;
                    const isEditing = editandoCampo === campoKey;
                    const rawVal = m.salario_fixo || 0;
                    const displayValue = isEditing
                      ? editandoValor
                      : rawVal ? rawVal.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "";

                    return (
                      <tr key={m.mecanico} className="border-t border-slate-50 hover:bg-slate-50/50">
                        <td className="px-3 py-2.5 text-slate-700 font-medium text-[13px]">
                          <div className="flex items-center gap-2">
                            {m.mecanico}
                            {m.isNew && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                Novo
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-1.5">
                          <select
                            value={m.filial || ""}
                            onChange={(e) => updateField(m.mecanico, "filial", e.target.value || null)}
                            className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                          >
                            <option value="">Selecione...</option>
                            {filiais.map((f) => (
                              <option key={f} value={f}>
                                {f}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-1.5">
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
                              updateField(m.mecanico, "salario_fixo", parsed);
                            }}
                            className="w-full text-right text-[13px] tabular-nums border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="0,00"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={m.comissionado}
                            onChange={(e) => updateField(m.mecanico, "comissionado", e.target.checked)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {mensagem && (
              <div className={`mx-4 my-3 rounded-lg px-3 py-2 text-sm ${mensagem.tipo === "sucesso" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {mensagem.texto}
              </div>
            )}

            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
              <p className="text-[11px] text-slate-400">
                {mecanicos.length} mecanico{mecanicos.length !== 1 ? "s" : ""} &middot;{" "}
                {mecanicos.filter((m) => m.comissionado).length} comissionado{mecanicos.filter((m) => m.comissionado).length !== 1 ? "s" : ""}
              </p>
              <button
                onClick={salvarTodos}
                disabled={salvando}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
              >
                {salvando ? "Salvando..." : "Salvar Todos"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
