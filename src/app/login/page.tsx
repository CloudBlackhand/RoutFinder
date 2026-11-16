"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: f.get("email"), password: f.get("password") }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setError(j.error ?? "Erro ao entrar");
    router.replace(`/${j.role}`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-slate-100">
      <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900 p-6">
        <h1 className="text-xl font-semibold">Finder</h1>
        <p className="text-sm text-slate-400">Rotas e rastreamento de instaladores</p>
        <input name="email" type="email" required placeholder="E-mail" className="rounded-lg bg-slate-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500" />
        <input name="password" type="password" required placeholder="Senha" className="rounded-lg bg-slate-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500" />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button disabled={busy} className="rounded-lg bg-sky-500 py-2 font-medium text-slate-950 disabled:opacity-50">{busy ? "Entrando..." : "Entrar"}</button>
      </form>
    </main>
  );
}
