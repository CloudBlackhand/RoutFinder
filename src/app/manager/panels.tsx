"use client";

import { useCallback, useEffect, useState } from "react";
import { JOB_COLOR, JOB_LABEL, type LiveData } from "@/lib/status";

const input = "w-full rounded-lg bg-slate-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500";
const post = (url: string, method: string, body?: unknown) =>
  fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });

type Hit = { label: string; lat: number; lng: number };

export function JobsPanel({ data, reload }: { data: LiveData | null; reload: () => void }) {
  const [form, setForm] = useState({ name: "", phone: "", address: "", type: "instalacao", installerId: "" });
  const [hits, setHits] = useState<Hit[]>([]);
  const [place, setPlace] = useState<Hit | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function search() {
    setMsg("");
    setPlace(null);
    const r = await fetch(`/api/manager/geocode?q=${encodeURIComponent(form.address)}`);
    const j = await r.json();
    if (!r.ok) return setMsg(j.error);
    setHits(j.results);
    if (!j.results.length) setMsg("Endereço não encontrado. Inclua cidade e estado.");
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!place) return setMsg("Busque e selecione o endereço.");
    setBusy(true);
    const r = await post("/api/manager/jobs", "POST", {
      name: form.name,
      phone: form.phone || undefined,
      address: place.label,
      lat: place.lat,
      lng: place.lng,
      type: form.type,
      installerId: form.installerId ? Number(form.installerId) : undefined,
    });
    setBusy(false);
    if (!r.ok) return setMsg((await r.json()).error ?? "Erro ao salvar");
    setForm({ name: "", phone: "", address: "", type: "instalacao", installerId: "" });
    setPlace(null);
    setHits([]);
    setMsg("Serviço criado.");
    reload();
  }

  const assign = async (id: number, v: string) => {
    await post(`/api/manager/jobs/${id}`, "PATCH", { installerId: v ? Number(v) : null });
    reload();
  };
  const remove = async (id: number) => {
    if (!confirm("Excluir este serviço?")) return;
    await post(`/api/manager/jobs/${id}`, "DELETE");
    reload();
  };

  const installers = data?.installers ?? [];
  const jobs = [...(data?.jobs ?? [])].sort((a, b) => (a.installerId ?? 0) - (b.installerId ?? 0) || (a.stopOrder ?? 99) - (b.stopOrder ?? 99));

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[380px_1fr]">
      <form onSubmit={create} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-slate-900 p-4">
        <h3 className="text-sm font-semibold">Novo serviço</h3>
        <input className={input} placeholder="Nome do cliente" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className={input} placeholder="Telefone (opcional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <div className="flex gap-2">
          <input className={input} placeholder="Rua, número, cidade" required value={form.address} onChange={(e) => { setForm({ ...form, address: e.target.value }); setPlace(null); }} />
          <button type="button" onClick={search} className="rounded-lg bg-slate-700 px-3 text-xs">Buscar</button>
        </div>
        {hits.length > 0 && !place && (
          <ul className="flex flex-col gap-1">
            {hits.map((h) => (
              <li key={`${h.lat},${h.lng}`}>
                <button type="button" onClick={() => { setPlace(h); setHits([]); }} className="w-full rounded bg-white/5 px-2 py-1 text-left text-xs hover:bg-white/10">{h.label}</button>
              </li>
            ))}
          </ul>
        )}
        {place && <p className="text-xs text-emerald-400">Local: {place.label}</p>}
        <div className="flex gap-2">
          <select className={input} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="instalacao">Instalação</option>
            <option value="reparo">Reparo</option>
          </select>
          <select className={input} value={form.installerId} onChange={(e) => setForm({ ...form, installerId: e.target.value })}>
            <option value="">Atribuir depois</option>
            {installers.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </div>
        <button disabled={busy} className="rounded-lg bg-emerald-500 py-2 text-sm font-medium text-slate-950 disabled:opacity-50">Adicionar</button>
        {msg && <p className="text-xs text-slate-300">{msg}</p>}
      </form>

      <section className="overflow-hidden rounded-xl border border-white/10 bg-slate-900">
        <h2 className="border-b border-white/10 px-4 py-3 font-semibold">Serviços de hoje ({jobs.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-2">Parada</th>
                <th className="px-4 py-2">Cliente</th>
                <th className="px-4 py-2">Tipo</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Instalador</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td className="px-4 py-3">{j.stopOrder ?? "-"}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{j.customer}</div>
                    <div className="line-clamp-1 max-w-xs text-xs text-slate-400">{j.address}</div>
                  </td>
                  <td className="px-4 py-3">{j.type === "reparo" ? "Reparo" : "Instalação"}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium text-slate-950" style={{ background: JOB_COLOR[j.status] }}>{JOB_LABEL[j.status]}</span>
                  </td>
                  <td className="px-4 py-3">
                    <select className={`${input} !py-1 text-xs`} value={j.installerId ?? ""} disabled={j.status !== "pendente"} onChange={(e) => assign(j.id, e.target.value)}>
                      <option value="">Sem instalador</option>
                      {installers.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => remove(j.id)} className="rounded-lg bg-red-500/20 px-2 py-1 text-xs text-red-300">Excluir</button>
                  </td>
                </tr>
              ))}
              {!jobs.length && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">Nenhum serviço hoje.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

type Member = { id: number; name: string; email: string; active: boolean };

export function TeamPanel({ reload }: { reload: () => void }) {
  const [team, setTeam] = useState<Member[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/manager/team", { cache: "no-store" });
    if (r.ok) setTeam((await r.json()).team);
  }, []);
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const r = await post("/api/manager/team", "POST", form);
    if (!r.ok) return setMsg((await r.json()).error ?? "Erro");
    setForm({ name: "", email: "", password: "" });
    setMsg("Instalador cadastrado.");
    load();
    reload();
  }
  async function toggle(m: Member) {
    await post(`/api/manager/team/${m.id}`, "PATCH", { active: !m.active });
    load();
    reload();
  }
  async function resetPassword(m: Member) {
    const password = prompt(`Nova senha para ${m.name} (mín. 6 caracteres):`);
    if (!password) return;
    const r = await post(`/api/manager/team/${m.id}`, "PATCH", { password });
    setMsg(r.ok ? "Senha alterada." : "Senha inválida.");
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[380px_1fr]">
      <form onSubmit={add} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-slate-900 p-4">
        <h3 className="text-sm font-semibold">Novo instalador</h3>
        <input className={input} placeholder="Nome" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className={input} type="email" placeholder="E-mail (login)" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className={input} type="password" placeholder="Senha (mín. 6)" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <button className="rounded-lg bg-emerald-500 py-2 text-sm font-medium text-slate-950">Cadastrar</button>
        {msg && <p className="text-xs text-slate-300">{msg}</p>}
      </form>
      <ul className="flex flex-col gap-2 rounded-xl border border-white/10 bg-slate-900 p-3">
        {team.map((m) => (
          <li key={m.id} className="rounded-lg border border-white/10 p-3 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className={m.active ? "font-medium" : "font-medium text-slate-500 line-through"}>{m.name}</div>
                <div className="text-xs text-slate-400">{m.email}</div>
              </div>
              <div className="flex gap-1 text-xs">
                <button onClick={() => resetPassword(m)} className="rounded bg-slate-700 px-2 py-1">Senha</button>
                <button onClick={() => toggle(m)} className="rounded bg-slate-700 px-2 py-1">{m.active ? "Desativar" : "Ativar"}</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
