"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Brand } from "@/components/ui";
import type { LiveData } from "@/lib/status";

type Live = { data: LiveData | null; reload: () => Promise<void> };
const LiveContext = createContext<Live>({ data: null, reload: async () => {} });
export const useLive = () => useContext(LiveContext);

const POLL_MS = 4000;
const TABS = [
  { href: "/manager", label: "Visão geral" },
  { href: "/manager/monitoramento", label: "Monitoramento" },
  { href: "/manager/servicos", label: "Serviços" },
  { href: "/manager/equipe", label: "Equipe" },
];

export default function ManagerShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [data, setData] = useState<LiveData | null>(null);
  const [online, setOnline] = useState(true);

  const reload = useCallback(async () => {
    try {
      const r = await fetch("/api/manager/live", { cache: "no-store" });
      if (r.status === 401) return router.replace("/login");
      setOnline(r.ok);
      if (r.ok) setData(await r.json());
    } catch {
      setOnline(false);
    }
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
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-20 flex h-12 shrink-0 items-stretch border-b border-line bg-panel">
          <Link href="/manager" className="flex items-center border-r border-line px-4">
            <Brand />
          </Link>
          <nav className="flex overflow-x-auto">
            {TABS.map((t) => {
              const active = t.href === "/manager" ? path === t.href : path.startsWith(t.href);
              return (
                <Link key={t.href} href={t.href} className={`flex items-center whitespace-nowrap border-b-2 px-4 text-[13px] ${active ? "border-fg text-fg" : "border-transparent text-mute hover:text-fg"}`}>
                  {t.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-4 px-4">
            <span className="num hidden items-center gap-2 text-[11px] uppercase tracking-wider text-mute sm:flex">
              <span className={`h-1.5 w-1.5 ${online && data ? "animate-pulse bg-emerald-400" : "bg-red-500"}`} />
              {online ? (data ? `Ao vivo · ${new Date(data.now).toLocaleTimeString("pt-BR")}` : "Conectando") : "Sem conexão"}
            </span>
            <button onClick={logout} className="btn btn-sm">Sair</button>
          </div>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    </LiveContext.Provider>
  );
}
