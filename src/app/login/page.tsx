"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, senha }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErro(data.error || "Erro ao fazer login");
        return;
      }

      const redirect = searchParams.get("redirect") || "/fechamento";
      router.push(redirect);
      router.refresh();
    } catch {
      setErro("Erro de conexao");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm px-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <div className="flex flex-col items-center mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.jpg"
              alt="Guerra Pedrotti"
              className="h-10 w-auto mb-3"
            />
            <h1 className="text-lg font-bold text-slate-800">
              Pecas & Servicos
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Faca login para continuar
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wide block mb-1.5">
                Usuario
              </label>
              <input
                type="text"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Digite seu usuario"
                autoComplete="username"
                autoFocus
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wide block mb-1.5">
                Senha
              </label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Digite sua senha"
                autoComplete="current-password"
              />
            </div>

            {erro && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !usuario || !senha}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-slate-400 mt-4">
          Grupo Pedrotti &middot; Controle de Pecas e Servicos
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
