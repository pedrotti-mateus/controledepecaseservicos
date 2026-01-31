"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/fechamento", label: "Fechamento" },
  { href: "/mecanicos", label: "Mecanicos" },
  { href: "/cadastro", label: "Cadastro" },
  { href: "/relatorios", label: "Relatorios" },
  { href: "/uploads", label: "Uploads" },
];

export default function NavBar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
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
            {LINKS.map((l) => (
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

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-slate-200 bg-white">
          <div className="px-4 py-2 space-y-1">
            {LINKS.map((l) => (
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
  );
}
