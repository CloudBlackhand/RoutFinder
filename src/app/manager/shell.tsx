"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { LiveData } from "@/lib/status";

type Live = { data: LiveData | null; reload: () => Promise<void> };
const LiveContext = createContext<Live>({ data: null, reload: async () => {} });
export const useLive = () => useContext(LiveContext);

const POLL_MS = 4000;
const TABS = [
  { href: "/manager", label: "Visão geral" },
  { href: "/manager/mapa", label: "Mapa 3D" },
  { href: "/manager/servicos", label: "Serviços" },
  { href: "/manager/equipe", label: "Equipe" },
];

export default function ManagerShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [data, setData] = useState<LiveData | null>(null);

  const reload = useCallback(async () => {
    const r = await fetch("/api/manager/live", { cache: "no-store" });
    if (r.status === 401) return router.replace("/login");
    if (r.ok) setData(await r.json());
  }, [router]);

  useEffect(() => {
    const t0 = setTimeout(reload, 0);
    const t = setInterval(reload, POLL_MS);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
  }, [reload]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  const value = useMemo(() => ({ data, reload }), [data, reload]);

  return (
    <LiveContext.Provider value={value}>
      <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-6 border-b border-white/10 bg-slate-900 px-4 sm:px-6">
          <Link href="/manager" className="text-lg font-semibold tracking-tight">Finder</Link>
          <nav className="flex gap-1 text-sm">
            {TABS.map((t) => {
              const active = t.href === "/manager" ? path === t.href : path.startsWith(t.href);
              return (
                <Link key={t.href} href={t.href} className={`rounded-md px-3 py-1.5 ${active ? "bg-sky-500 font-medium text-slate-950" : "text-slate-300 hover:bg-white/5"}`}>
                  {t.label}
                </Link>
              );
            })}
          </nav>
          <button onClick={logout} className="ml-auto text-sm text-slate-400 hover:text-white">Sair</button>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    </LiveContext.Provider>
  );
}
