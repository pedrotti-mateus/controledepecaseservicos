"use client";

import { useCallback, useEffect, useState } from "react";

interface UploadLog {
  id: number;
  nome_arquivo: string;
  tamanho_bytes: number;
  total_registros: number;
  registros_inseridos: number;
  storage_path: string | null;
  status: string;
  erros: string[] | null;
  uploaded_at: string;
  tipo: string | null;
}

interface UploadResult {
  success?: boolean;
  total_rows?: number;
  inserted?: number;
  message?: string;
  errors?: string[];
  error?: string;
  periodo?: string;
  mecanicos?: number;
  total_servicos?: number;
  total_comissao?: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

const STATUS_STYLE: Record<string, string> = {
  sucesso: "bg-emerald-50 text-emerald-700",
  parcial: "bg-amber-50 text-amber-700",
  erro: "bg-red-50 text-red-700",
};

const TIPO_LABELS: Record<string, { label: string; style: string }> = {
  pecas_servicos: { label: "Pecas & Servicos", style: "bg-blue-50 text-blue-700" },
  mecanicos: { label: "Mecanicos", style: "bg-violet-50 text-violet-700" },
};

export default function UploadPage() {
  // Excel upload state
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelUploading, setExcelUploading] = useState(false);
  const [excelResult, setExcelResult] = useState<UploadResult | null>(null);

  // PDF upload state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfResult, setPdfResult] = useState<UploadResult | null>(null);
  const [pdfDragOver, setPdfDragOver] = useState(false);

  // Logs
  const [logs, setLogs] = useState<UploadLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/upload-logs");
      const data = await res.json();
      setLogs(data.logs || []);
    } catch {
      // ignore
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Excel upload handler
  async function handleExcelUpload() {
    if (!excelFile) return;
    setExcelUploading(true);
    setExcelResult(null);
    try {
      const formData = new FormData();
      formData.append("file", excelFile);
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await response.json();
      setExcelResult(data);
      if (data.success) {
        setExcelFile(null);
        fetchLogs();
      }
    } catch (err) {
      setExcelResult({ error: err instanceof Error ? err.message : "Erro ao enviar arquivo" });
    } finally {
      setExcelUploading(false);
    }
  }

  // PDF upload handler
  async function handlePdfUpload() {
    if (!pdfFile) return;
    setPdfUploading(true);
    setPdfResult(null);
    try {
      const formData = new FormData();
      formData.append("file", pdfFile);
      const response = await fetch("/api/mecanicos/upload", { method: "POST", body: formData });
      const data = await response.json();
      setPdfResult(data);
      if (data.success) {
        setPdfFile(null);
        fetchLogs();
      }
    } catch (err) {
      setPdfResult({ error: err instanceof Error ? err.message : "Erro ao enviar arquivo" });
    } finally {
      setPdfUploading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">Uploads</h1>
        <p className="text-sm text-slate-400 mt-1">
          Importe os arquivos de pecas/servicos e comissoes dos mecanicos
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Excel Upload - Pecas & Servicos */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">Pecas & Servicos</p>
              <p className="text-[11px] text-slate-400">Arquivo Excel (.xlsx)</p>
            </div>
          </div>

          <label className="block cursor-pointer">
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                excelFile ? "border-blue-300 bg-blue-50/50" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              {excelFile ? (
                <div>
                  <p className="text-sm font-medium text-blue-600">{excelFile.name}</p>
                  <p className="text-xs text-slate-400 mt-1">{formatBytes(excelFile.size)}</p>
                </div>
              ) : (
                <div>
                  <svg className="w-8 h-8 text-slate-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm text-slate-500">
                    <span className="font-medium text-blue-600">Clique para selecionar</span> ou arraste
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Base de pecas e servicos (.xlsx)</p>
                </div>
              )}
            </div>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                setExcelFile(e.target.files?.[0] || null);
                e.target.value = "";
              }}
            />
          </label>

          <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
            <p className="text-[11px] text-slate-500">
              <span className="font-medium text-slate-600">Sobreposicao inteligente:</span> substitui registros a partir da data mais antiga no arquivo.
            </p>
          </div>

          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={handleExcelUpload}
              disabled={!excelFile || excelUploading}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
            >
              {excelUploading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Importando...
                </span>
              ) : (
                "Importar Excel"
              )}
            </button>
            {excelFile && !excelUploading && (
              <button
                onClick={() => { setExcelFile(null); setExcelResult(null); }}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Cancelar
              </button>
            )}
          </div>

          {excelResult && (
            <div className={`mt-3 rounded-lg p-3 text-sm ${excelResult.success ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
              {excelResult.success ? (
                <div>
                  <p className="text-emerald-800 font-medium text-[13px]">Importado com sucesso</p>
                  {excelResult.message && <p className="text-emerald-600 text-xs mt-1">{excelResult.message}</p>}
                  {excelResult.errors && excelResult.errors.length > 0 && (
                    <div className="mt-1.5 space-y-0.5">
                      {excelResult.errors.map((err, i) => (
                        <p key={i} className="text-amber-600 text-xs">{err}</p>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-red-700 text-[13px]">{excelResult.error}</p>
              )}
            </div>
          )}
        </div>

        {/* PDF Upload - Mecanicos */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">Mecanicos</p>
              <p className="text-[11px] text-slate-400">Relatorio de comissao (.pdf)</p>
            </div>
          </div>

          <label
            className={`block cursor-pointer ${pdfDragOver ? "ring-2 ring-violet-400 rounded-xl" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setPdfDragOver(true); }}
            onDragLeave={() => setPdfDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setPdfDragOver(false);
              const f = e.dataTransfer.files[0];
              if (f && f.name.toLowerCase().endsWith(".pdf")) setPdfFile(f);
            }}
          >
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                pdfDragOver
                  ? "border-violet-400 bg-violet-50/50"
                  : pdfFile
                    ? "border-violet-300 bg-violet-50/30"
                    : "border-slate-200 hover:border-slate-300"
              }`}
            >
              {pdfFile ? (
                <div>
                  <p className="text-sm font-medium text-violet-600">{pdfFile.name}</p>
                  <p className="text-xs text-slate-400 mt-1">{formatBytes(pdfFile.size)}</p>
                </div>
              ) : (
                <div>
                  <svg className="w-8 h-8 text-slate-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm text-slate-500">
                    <span className="font-medium text-violet-600">Clique para selecionar</span> ou arraste
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Relatorio de Comissao dos Mecanicos (.pdf)</p>
                </div>
              )}
            </div>
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                setPdfFile(e.target.files?.[0] || null);
                e.target.value = "";
              }}
            />
          </label>

          <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
            <p className="text-[11px] text-slate-500">
              <span className="font-medium text-slate-600">Substituicao por periodo:</span> substitui os dados do mes/ano identificado no PDF.
            </p>
          </div>

          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={handlePdfUpload}
              disabled={!pdfFile || pdfUploading}
              className="flex-1 bg-violet-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
            >
              {pdfUploading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Importando...
                </span>
              ) : (
                "Importar PDF"
              )}
            </button>
            {pdfFile && !pdfUploading && (
              <button
                onClick={() => { setPdfFile(null); setPdfResult(null); }}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Cancelar
              </button>
            )}
          </div>

          {pdfResult && (
            <div className={`mt-3 rounded-lg p-3 text-sm ${pdfResult.success ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
              {pdfResult.success ? (
                <div>
                  <p className="text-emerald-800 font-medium text-[13px]">Importado com sucesso</p>
                  <p className="text-emerald-600 text-xs mt-1">
                    Periodo: {pdfResult.periodo} &middot; {pdfResult.mecanicos} mecanicos &middot;
                    Faturamento: {formatBRL(pdfResult.total_servicos || 0)} &middot;
                    Comissao: {formatBRL(pdfResult.total_comissao || 0)}
                  </p>
                </div>
              ) : (
                <p className="text-red-700 text-[13px]">{pdfResult.error}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Upload History */}
      <div>
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Historico de Uploads</h2>

        {loadingLogs ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
            <p className="text-sm text-slate-400">Carregando...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
            <p className="text-sm text-slate-400">Nenhum upload realizado ainda.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-100">
                  <th className="px-4 py-2.5 text-left font-semibold">Data/Hora</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Tipo</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Arquivo</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Tamanho</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Registros</th>
                  <th className="px-4 py-2.5 text-center font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const tipoInfo = TIPO_LABELS[log.tipo || "pecas_servicos"] || TIPO_LABELS.pecas_servicos;
                  return (
                    <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-2.5 whitespace-nowrap text-slate-600 tabular-nums text-[13px]">
                        {formatDateTime(log.uploaded_at)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-medium ${tipoInfo.style}`}>
                          {tipoInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-800 font-medium text-[13px]">
                        <span className="truncate block max-w-[200px]">{log.nome_arquivo}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-500 whitespace-nowrap tabular-nums text-[13px]">
                        {formatBytes(log.tamanho_bytes)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-500 whitespace-nowrap tabular-nums text-[13px]">
                        {log.registros_inseridos.toLocaleString("pt-BR")} / {log.total_registros.toLocaleString("pt-BR")}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-medium ${STATUS_STYLE[log.status] || "bg-slate-100 text-slate-600"}`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
