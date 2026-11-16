"use client";

import { useCallback, useEffect, useState } from "react";
import { Status } from "@/components/ui";
import { JOB_COLOR, JOB_LABEL, type LiveData } from "@/lib/status";

const post = (url: string, method: string, body?: unknown) =>
  fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });

type Hit = { label: string; lat: number; lng: number };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

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
    <div className="grid items-start gap-5 lg:grid-cols-[340px_1fr]">
      <form onSubmit={create} className="panel">
        <div className="panel-head"><span className="label">Novo serviço</span></div>
        <div className="flex flex-col gap-3 p-3">
          <Field label="Cliente">
            <input className="field" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Telefone (opcional)">
            <input className="field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Endereço">
            <div className="flex gap-2">
              <input className="field" placeholder="Rua, número, cidade" required value={form.address} onChange={(e) => { setForm({ ...form, address: e.target.value }); setPlace(null); }} />
              <button type="button" onClick={search} className="btn">Buscar</button>
            </div>
          </Field>
          {hits.length > 0 && !place && (
            <ul className="border border-line">
              {hits.map((h) => (
                <li key={`${h.lat},${h.lng}`} className="border-b border-line last:border-0">
                  <button type="button" onClick={() => { setPlace(h); setHits([]); }} className="w-full px-2.5 py-2 text-left text-xs leading-snug hover:bg-raised">{h.label}</button>
                </li>
              ))}
            </ul>
          )}
          {place && <p className="border-l-2 border-emerald-400 pl-2 text-xs leading-snug text-mute">{place.label}</p>}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Tipo">
              <select className="field" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="instalacao">Instalação</option>
                <option value="reparo">Reparo</option>
              </select>
            </Field>
            <Field label="Instalador">
              <select className="field" value={form.installerId} onChange={(e) => setForm({ ...form, installerId: e.target.value })}>
                <option value="">Atribuir depois</option>
                {installers.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </Field>
          </div>
          <button disabled={busy} className="btn btn-primary mt-1">Adicionar serviço</button>
          {msg && <p className="text-xs text-mute">{msg}</p>}
        </div>
      </form>

      <section className="panel overflow-hidden">
        <div className="panel-head">
          <span className="label">Serviços de hoje</span>
          <span className="num text-[11px] text-mute">{jobs.length} no total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>#</th>
                <th>Cliente</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Instalador</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td className="num text-mute">{j.stopOrder ? String(j.stopOrder).padStart(2, "0") : "--"}</td>
                  <td>
                    <div className="font-medium">{j.customer}</div>
                    <div className="line-clamp-1 max-w-sm text-xs text-mute">{j.address}</div>
                  </td>
                  <td>{j.type === "reparo" ? "Reparo" : "Instalação"}</td>
                  <td><Status color={JOB_COLOR[j.status]} label={JOB_LABEL[j.status]} /></td>
                  <td>
                    <select className="field !h-7 min-w-40 !text-xs" value={j.installerId ?? ""} disabled={j.status !== "pendente"} onChange={(e) => assign(j.id, e.target.value)}>
                      <option value="">Sem instalador</option>
                      {installers.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </td>
                  <td className="text-right"><button onClick={() => remove(j.id)} className="btn btn-sm btn-danger">Excluir</button></td>
                </tr>
              ))}
              {!jobs.length && <tr><td colSpan={6} className="!py-8 text-center text-dim">Nenhum serviço hoje.</td></tr>}
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
    <div className="grid items-start gap-5 lg:grid-cols-[340px_1fr]">
      <form onSubmit={add} className="panel">
        <div className="panel-head"><span className="label">Novo instalador</span></div>
        <div className="flex flex-col gap-3 p-3">
          <Field label="Nome">
            <input className="field" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="E-mail (login)">
            <input className="field" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Senha (mín. 6)">
            <input className="field" type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <button className="btn btn-primary mt-1">Cadastrar instalador</button>
          {msg && <p className="text-xs text-mute">{msg}</p>}
        </div>
      </form>

      <section className="panel overflow-hidden">
        <div className="panel-head">
          <span className="label">Instaladores</span>
          <span className="num text-[11px] text-mute">{team.filter((m) => m.active).length}/{team.length} ativos</span>
        </div>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Login</th>
                <th>Situação</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {team.map((m) => (
                <tr key={m.id}>
                  <td className={m.active ? "font-medium" : "text-dim"}>{m.name}</td>
                  <td className="num text-xs text-mute">{m.email}</td>
                  <td><Status color={m.active ? "#34d399" : "#5c5c66"} label={m.active ? "Ativo" : "Inativo"} /></td>
                  <td>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => resetPassword(m)} className="btn btn-sm">Alterar senha</button>
                      <button onClick={() => toggle(m)} className={`btn btn-sm ${m.active ? "btn-danger" : ""}`}>{m.active ? "Desativar" : "Ativar"}</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!team.length && <tr><td colSpan={4} className="!py-8 text-center text-dim">Nenhum instalador cadastrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
