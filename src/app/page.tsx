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
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
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

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    success?: boolean;
    total_rows?: number;
    inserted?: number;
    message?: string;
    errors?: string[];
    error?: string;
  } | null>(null);
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

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await response.json();
      setResult(data);
      if (data.success) fetchLogs();
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : "Erro ao enviar arquivo" });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">Upload de Dados</h1>
        <p className="text-sm text-slate-400 mt-1">
          Importe o arquivo Excel com a base de pecas e servicos
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <label className="block cursor-pointer">
          <div
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
              file ? "border-blue-300 bg-blue-50/50" : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            {file ? (
              <div>
                <p className="text-sm font-medium text-blue-600">{file.name}</p>
                <p className="text-xs text-slate-400 mt-1">{formatBytes(file.size)}</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-slate-600">
                  <span className="font-medium text-blue-600">Clique para selecionar</span> ou arraste o arquivo
                </p>
                <p className="text-xs text-slate-400 mt-1">Formato .xlsx</p>
              </div>
            )}
          </div>
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>

        <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5">
          <p className="text-[12px] text-slate-500">
            <span className="font-medium text-slate-600">Sobreposicao inteligente:</span> o sistema identifica a data mais antiga no arquivo e substitui todos os registros a partir dessa data. Dados anteriores sao mantidos.
          </p>
        </div>

        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="mt-4 w-full bg-blue-600 text-white py-2.5 px-4 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
        >
          {uploading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Importando...
            </span>
          ) : (
            "Importar Dados"
          )}
        </button>
      </div>

      {result && (
        <div className={`mt-4 rounded-xl p-4 ${result.success ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
          {result.success ? (
            <div>
              <p className="text-emerald-800 text-sm font-medium">Importacao concluida com sucesso</p>
              {result.message && (
                <p className="text-emerald-600 text-xs mt-1">{result.message}</p>
              )}
              {result.errors && result.errors.length > 0 && (
                <div className="mt-2 space-y-0.5">
                  {result.errors.map((err, i) => (
                    <p key={i} className="text-amber-600 text-xs">{err}</p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-red-700 text-sm">{result.error}</p>
          )}
        </div>
      )}

      {/* Upload History */}
      <div className="mt-10">
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
                  <th className="px-4 py-2.5 text-left font-semibold">Arquivo</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Tamanho</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Registros</th>
                  <th className="px-4 py-2.5 text-center font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-2.5 whitespace-nowrap text-slate-600 tabular-nums text-[13px]">
                      {formatDateTime(log.uploaded_at)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-800 font-medium text-[13px]">
                      <span className="truncate block max-w-[220px]">{log.nome_arquivo}</span>
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
