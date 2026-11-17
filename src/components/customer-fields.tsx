"use client";

import { useState } from "react";
import { SOURCE } from "@/lib/telecom";
import { Field } from "./ui";

type Defaults = Partial<Record<"name" | "personType" | "document" | "birthDate" | "phone" | "phone2" | "email" | "zip" | "street" | "number" | "complement" | "neighborhood" | "city" | "uf" | "source" | "notes", string | null>> & {
  sellerId?: number | null;
};

const ADDR = ["zip", "street", "number", "complement", "neighborhood", "city", "uf"] as const;

export function CustomerFields({ d = {}, sellers, compact }: { d?: Defaults; sellers: { id: number; name: string }[]; compact?: boolean }) {
  const [pj, setPj] = useState(d.personType === "pj");
  const [addr, setAddr] = useState<Record<(typeof ADDR)[number], string>>(() => Object.fromEntries(ADDR.map((k) => [k, d[k] ?? ""])) as Record<(typeof ADDR)[number], string>);
  const [cepMsg, setCepMsg] = useState("");
  const set = (k: (typeof ADDR)[number]) => (e: React.ChangeEvent<HTMLInputElement>) => setAddr((a) => ({ ...a, [k]: e.target.value }));

  async function lookup() {
    const cep = addr.zip.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setCepMsg("Buscando CEP...");
    try {
      const r = await (await fetch(`https://viacep.com.br/ws/${cep}/json/`)).json();
      if (r.erro) return setCepMsg("CEP não encontrado.");
      setAddr((a) => ({ ...a, zip: `${cep.slice(0, 5)}-${cep.slice(5)}`, street: r.logradouro || a.street, neighborhood: r.bairro || a.neighborhood, city: r.localidade || a.city, uf: r.uf || a.uf }));
      setCepMsg("");
    } catch {
      setCepMsg("Não foi possível consultar o CEP.");
    }
  }

  const g2 = compact ? "grid grid-cols-2 gap-3" : "grid gap-3 sm:grid-cols-2";
  return (
    <>
      <div className="label border-b border-line pb-1.5 text-dim">Identificação</div>
      <div className={g2}>
        <Field label="Tipo">
          <select name="personType" defaultValue={pj ? "pj" : "pf"} onChange={(e) => setPj(e.target.value === "pj")} className="field">
            <option value="pf">Pessoa física</option>
            <option value="pj">Pessoa jurídica</option>
          </select>
        </Field>
        <Field label={pj ? "CNPJ" : "CPF"}>
          <input name="document" defaultValue={d.document ?? ""} placeholder={pj ? "00.000.000/0000-00" : "000.000.000-00"} className="field" />
        </Field>
      </div>
      <Field label={pj ? "Razão social" : "Nome completo"}>
        <input name="name" required defaultValue={d.name ?? ""} className="field" />
      </Field>
      <div className={g2}>
        <Field label={pj ? "Fundação" : "Nascimento"}>
          <input name="birthDate" type="date" defaultValue={d.birthDate ?? ""} className="field" />
        </Field>
        <Field label="E-mail">
          <input name="email" type="email" defaultValue={d.email ?? ""} className="field" />
        </Field>
        <Field label="Celular / WhatsApp">
          <input name="phone" defaultValue={d.phone ?? ""} placeholder="(11) 90000-0000" className="field" />
        </Field>
        <Field label="Telefone 2">
          <input name="phone2" defaultValue={d.phone2 ?? ""} className="field" />
        </Field>
      </div>

      <div className="label mt-1 border-b border-line pb-1.5 text-dim">Endereço de instalação</div>
      <div className="grid grid-cols-[1fr_auto] items-end gap-2">
        <Field label="CEP">
          <input name="zip" value={addr.zip} onChange={set("zip")} onBlur={lookup} placeholder="00000-000" className="field" />
        </Field>
        <button type="button" onClick={lookup} className="btn">Buscar CEP</button>
      </div>
      {cepMsg && <p className="text-[11px] text-mute">{cepMsg}</p>}
      <div className="grid grid-cols-[1fr_90px] gap-3">
        <Field label="Rua">
          <input name="street" required value={addr.street} onChange={set("street")} className="field" />
        </Field>
        <Field label="Número">
          <input name="number" value={addr.number} onChange={set("number")} className="field" />
        </Field>
      </div>
      <div className={g2}>
        <Field label="Complemento">
          <input name="complement" value={addr.complement} onChange={set("complement")} className="field" />
        </Field>
        <Field label="Bairro">
          <input name="neighborhood" value={addr.neighborhood} onChange={set("neighborhood")} className="field" />
        </Field>
      </div>
      <div className="grid grid-cols-[1fr_70px] gap-3">
        <Field label="Cidade">
          <input name="city" required value={addr.city} onChange={set("city")} className="field" />
        </Field>
        <Field label="UF">
          <input name="uf" maxLength={2} value={addr.uf} onChange={set("uf")} className="field uppercase" />
        </Field>
      </div>

      <div className="label mt-1 border-b border-line pb-1.5 text-dim">Comercial</div>
      <div className={g2}>
        <Field label="Origem">
          <select name="source" defaultValue={d.source ?? ""} className="field">
            <option value="">Não informada</option>
            {Object.entries(SOURCE).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>
        <Field label="Vendedor responsável">
          <select name="sellerId" defaultValue={d.sellerId ?? ""} className="field">
            <option value="">Nenhum</option>
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Observações">
        <textarea name="notes" rows={2} defaultValue={d.notes ?? ""} className="field h-auto py-2" />
      </Field>
    </>
  );
}
