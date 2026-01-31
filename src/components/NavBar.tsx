"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

interface NavLink {
  href: string;
  label: string;
  roles: string[];
}

const ALL_LINKS: NavLink[] = [
  { href: "/fechamento", label: "Fechamento", roles: ["admin", "colaborador"] },
  { href: "/mecanicos", label: "Mecanicos", roles: ["admin", "colaborador"] },
  { href: "/cadastro", label: "Cadastro", roles: ["admin"] },
  { href: "/relatorios", label: "Relatorios", roles: ["admin"] },
  { href: "/uploads", label: "Uploads", roles: ["admin", "colaborador"] },
];

export default function NavBar() {
  const [open, setOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [usuario, setUsuario] = useState("");
  const [perfil, setPerfil] = useState("");
  const [showSenhaModal, setShowSenhaModal] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [senhaConfirmar, setSenhaConfirmar] = useState("");
  const [senhaErro, setSenhaErro] = useState("");
  const [senhaSucesso, setSenhaSucesso] = useState(false);
  const [senhaLoading, setSenhaLoading] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setUsuario(d.usuario);
          setPerfil(d.perfil);
        }
      })
      .catch(() => {});
  }, []);

  // Close user menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenu(false);
      }
    }
    if (userMenu) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [userMenu]);

  const links = ALL_LINKS.filter((l) => !perfil || l.roles.includes(perfil));

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function openSenhaModal() {
    setUserMenu(false);
    setSenhaAtual("");
    setSenhaNova("");
    setSenhaConfirmar("");
    setSenhaErro("");
    setSenhaSucesso(false);
    setShowSenhaModal(true);
  }

  async function handleAlterarSenha(e: React.FormEvent) {
    e.preventDefault();
    setSenhaErro("");
    setSenhaSucesso(false);

    if (senhaNova !== senhaConfirmar) {
      setSenhaErro("As senhas nao coincidem");
      return;
    }
    if (senhaNova.length < 6) {
      setSenhaErro("A nova senha deve ter pelo menos 6 caracteres");
      return;
    }

    setSenhaLoading(true);
    try {
      const res = await fetch("/api/auth/alterar-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha_atual: senhaAtual, senha_nova: senhaNova }),
      });
      const data = await res.json();

      if (!res.ok) {
        setSenhaErro(data.error || "Erro ao alterar senha");
        return;
      }

      setSenhaSucesso(true);
      setTimeout(() => setShowSenhaModal(false), 1500);
    } catch {
      setSenhaErro("Erro de conexao");
    } finally {
      setSenhaLoading(false);
    }
  }

  return (
    <>
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <Link href="/" className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.jpg"
                alt="Guerra Pedrotti"
                className="h-[18px] w-auto"
              />
              <span className="text-[15px] font-semibold text-slate-800">
                Pecas & Servicos
              </span>
            </Link>

            {/* Desktop links */}
            <div className="hidden md:flex items-center gap-1">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    pathname === l.href
                      ? "text-blue-600 bg-blue-50"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                  }`}
                >
                  {l.label}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {/* User menu */}
              {usuario && (
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setUserMenu((v) => !v)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                    <span className="hidden sm:inline">{usuario}</span>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>

                  {userMenu && (
                    <div className="absolute right-0 mt-1 w-52 bg-white rounded-lg border border-slate-200 shadow-lg py-1 z-50">
                      <div className="px-3 py-2 border-b border-slate-100">
                        <p className="text-sm font-medium text-slate-800">{usuario}</p>
                        <p className="text-xs text-slate-400 capitalize">{perfil}</p>
                      </div>
                      <button
                        onClick={openSenhaModal}
                        className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        Alterar Senha
                      </button>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        Sair
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Hamburger button */}
              <button
                onClick={() => setOpen((v) => !v)}
                className="md:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                aria-label="Abrir menu"
              >
                {open ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="md:hidden border-t border-slate-200 bg-white">
            <div className="px-4 py-2 space-y-1">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    pathname === l.href
                      ? "text-blue-600 bg-blue-50"
                      : "text-slate-600 hover:text-slate-800 hover:bg-slate-100"
                  }`}
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Password change modal */}
      {showSenhaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-slate-800">Alterar Senha</h2>
              <button
                onClick={() => setShowSenhaModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {senhaSucesso ? (
              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-3 text-sm text-green-700 text-center">
                Senha alterada com sucesso!
              </div>
            ) : (
              <form onSubmit={handleAlterarSenha} className="space-y-3">
                <div>
                  <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wide block mb-1">
                    Senha Atual
                  </label>
                  <input
                    type="password"
                    value={senhaAtual}
                    onChange={(e) => setSenhaAtual(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    autoComplete="current-password"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wide block mb-1">
                    Nova Senha
                  </label>
                  <input
                    type="password"
                    value={senhaNova}
                    onChange={(e) => setSenhaNova(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wide block mb-1">
                    Confirmar Nova Senha
                  </label>
                  <input
                    type="password"
                    value={senhaConfirmar}
                    onChange={(e) => setSenhaConfirmar(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    autoComplete="new-password"
                  />
                </div>

                {senhaErro && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                    {senhaErro}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={senhaLoading || !senhaAtual || !senhaNova || !senhaConfirmar}
                  className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
                >
                  {senhaLoading ? "Salvando..." : "Salvar Nova Senha"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
