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
const NAV = [
  {
    group: "Operação",
    items: [
      { href: "/manager", label: "Visão geral", icon: "M3 3h7v7H3zM14 3h7v4h-7zM14 11h7v10h-7zM3 14h7v7H3z" },
      { href: "/manager/monitoramento", label: "Monitoramento", icon: "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" },
    ],
  },
  {
    group: "Gestão",
    items: [
      { href: "/manager/servicos", label: "Serviços", icon: "M4 5h16M4 12h16M4 19h10" },
      { href: "/manager/equipe", label: "Equipe", icon: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 4a4 4 0 0 1 0 7M22 21v-1a6 6 0 0 0-4-5.6" },
    ],
  },
];

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="square">
      <path d={d} />
    </svg>
  );
}

export default function ManagerShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [data, setData] = useState<LiveData | null>(null);
  const [online, setOnline] = useState(true);
  const [open, setOpen] = useState(false);

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
      <div className="flex min-h-screen">
        <button onClick={() => setOpen(true)} aria-label="Abrir menu" className="btn btn-sm fixed left-3 top-3 z-30 md:hidden">
          Menu
        </button>
        {open && <div onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-black/60 md:hidden" />}
        <aside className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-line bg-panel transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
          <Link href="/manager" className="flex h-14 shrink-0 items-center border-b border-line px-5">
            <Brand />
          </Link>
          <nav className="flex-1 overflow-y-auto py-4">
            {NAV.map((g) => (
              <div key={g.group} className="mb-5">
                <div className="label px-5 pb-2">{g.group}</div>
                {g.items.map((t) => {
                  const active = t.href === "/manager" ? path === t.href : path.startsWith(t.href);
                  return (
                    <Link
                      key={t.href}
                      href={t.href}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 border-l-2 px-5 py-2 text-[13px] ${active ? "border-fg bg-fg/[0.06] text-fg" : "border-transparent text-mute hover:bg-fg/[0.03] hover:text-fg"}`}
                    >
                      <Icon d={t.icon} />
                      {t.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
          <div className="shrink-0 border-t border-line p-4">
            <div className="num mb-3 flex items-center gap-2 text-[11px] uppercase tracking-wider text-mute">
              <span className={`h-1.5 w-1.5 ${online && data ? "animate-pulse bg-emerald-400" : "bg-red-500"}`} />
              {online ? (data ? `Ao vivo · ${new Date(data.now).toLocaleTimeString("pt-BR")}` : "Conectando") : "Sem conexão"}
            </div>
            <button onClick={logout} className="btn btn-sm w-full">Sair</button>
          </div>
        </aside>
        <main className="flex min-w-0 flex-1 flex-col pt-12 md:pt-0">{children}</main>
      </div>
    </LiveContext.Provider>
  );
}
