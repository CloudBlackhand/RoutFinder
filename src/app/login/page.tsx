"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/ui";

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
    <main className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="panel w-full max-w-sm">
        <div className="panel-head !h-12">
          <Brand />
          <span className="label">Acesso</span>
        </div>
        <div className="flex flex-col gap-4 p-5">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Entrar</h1>
            <p className="mt-1 text-xs text-mute">Rotas e monitoramento de equipes de instalação.</p>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="label">E-mail</span>
            <input name="email" type="email" required autoComplete="username" className="field !h-9" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">Senha</span>
            <input name="password" type="password" required autoComplete="current-password" className="field !h-9" />
          </label>
          {error && <p className="border-l-2 border-red-500 pl-2 text-xs text-red-400">{error}</p>}
          <button disabled={busy} className="btn btn-primary !h-9">{busy ? "Entrando..." : "Entrar"}</button>
        </div>
      </form>
    </main>
  );
}
