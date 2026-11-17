"use client";

import { useMemo, useState } from "react";
import { CustomerFields } from "@/components/customer-fields";
import { ActionForm, Submit } from "@/components/forms";
import { Field } from "@/components/ui";
import { SOURCE, TECH, brl, fmtDate, type Tech } from "@/lib/telecom";
import { createSale } from "../../actions";

type Customer = { id: number; name: string; document: string | null; phone: string | null; address: string; sellerId: number | null; source: string | null };
type Plan = { id: number; name: string; downMbps: number; upMbps: number; priceCents: number; tech: Tech };
type Named = { id: number; name: string };

const money = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const parse = (v: string) => {
  const n = Number(v.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
};

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <span className="label">
          <span className="num mr-2 text-fg">{String(n).padStart(2, "0")}</span>
          {title}
        </span>
      </div>
      <div className="flex flex-col gap-3 p-4">{children}</div>
    </section>
  );
}

export function SaleForm({ customers, plans, sellers, installers, preselect, tomorrow }: { customers: Customer[]; plans: Plan[]; sellers: Named[]; installers: Named[]; preselect: number | null; tomorrow: string }) {
  const [mode, setMode] = useState<"novo" | "existente">(preselect ? "existente" : "novo");
  const [customerId, setCustomerId] = useState<number | null>(preselect);
  const [query, setQuery] = useState("");
  const [planId, setPlanId] = useState<number | null>(plans[0]?.id ?? null);
  const [price, setPrice] = useState(plans[0] ? money(plans[0].priceCents) : "");
  const [fee, setFee] = useState("");
  const [dueDay, setDueDay] = useState("10");
  const [schedule, setSchedule] = useState<"agora" | "depois">("agora");
  const [day, setDay] = useState(tomorrow);

  const customer = customers.find((c) => c.id === customerId) ?? null;
  const plan = plans.find((p) => p.id === planId) ?? null;
  const matches = useMemo(() => {
    const t = query.trim().toLowerCase();
    const digits = t.replace(/\D/g, "");
    return customers.filter((c) => !t || c.name.toLowerCase().includes(t) || (digits && ((c.document ?? "").replace(/\D/g, "").includes(digits) || (c.phone ?? "").replace(/\D/g, "").includes(digits)))).slice(0, 6);
  }, [customers, query]);

  const tab = (active: boolean) => `btn flex-1 ${active ? "btn-primary" : ""}`;

  return (
    <ActionForm keep action={createSale} className="grid items-start gap-5 xl:grid-cols-[1fr_340px]">
      <div className="flex min-w-0 flex-col gap-5">
        <Step n={1} title="Cliente">
          <input type="hidden" name="mode" value={mode} />
          <div className="flex max-w-md">
            <button type="button" onClick={() => setMode("novo")} className={tab(mode === "novo")}>Cliente novo</button>
            <button type="button" onClick={() => setMode("existente")} className={`${tab(mode === "existente")} -ml-px`}>Cliente já cadastrado</button>
          </div>

          {mode === "novo" ? (
            <div className="flex max-w-3xl flex-col gap-3">
              <CustomerFields hideCommercial />
            </div>
          ) : customer ? (
            <div className="flex max-w-3xl items-center justify-between gap-3 border border-line bg-bg p-3">
              <input type="hidden" name="customerId" value={customer.id} />
              <div className="min-w-0">
                <div className="font-medium">{customer.name}</div>
                <div className="truncate text-[12px] text-mute">
                  {[customer.document, customer.phone, customer.address].filter(Boolean).join(" · ")}
                </div>
              </div>
              <button type="button" onClick={() => setCustomerId(null)} className="btn btn-sm">Trocar</button>
            </div>
          ) : (
            <div className="max-w-3xl">
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Digite nome, CPF/CNPJ ou telefone" className="field" />
              <div className="mt-2 border border-line">
                {matches.map((c) => (
                  <button key={c.id} type="button" onClick={() => setCustomerId(c.id)} className="flex w-full items-center justify-between gap-3 border-b border-line px-3 py-2 text-left last:border-b-0 hover:bg-raised">
                    <span className="min-w-0">
                      <span className="font-medium">{c.name}</span>
                      <span className="block truncate text-[12px] text-mute">{[c.document, c.phone, c.address].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span className="label shrink-0">Selecionar</span>
                  </button>
                ))}
                {!matches.length && <p className="px-3 py-4 text-center text-mute">Nenhum cliente encontrado. Use &quot;Cliente novo&quot;.</p>}
              </div>
            </div>
          )}
        </Step>

        <Step n={2} title="Plano">
          <input type="hidden" name="planId" value={planId ?? ""} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((p) => {
              const on = p.id === planId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPlanId(p.id);
                    setPrice(money(p.priceCents));
                  }}
                  className={`border p-3 text-left transition-colors ${on ? "border-fg bg-fg/[0.06]" : "border-line hover:border-mute"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="label">{TECH[p.tech]}</span>
                    <span className={`h-2.5 w-2.5 border ${on ? "border-fg bg-fg" : "border-mute"}`} />
                  </div>
                  <div className="mt-2 font-medium">{p.name}</div>
                  <div className="num text-[11px] text-mute">{p.downMbps}/{p.upMbps} Mbps</div>
                  <div className="num mt-2 text-lg">{brl(p.priceCents)}<span className="text-[11px] text-mute">/mês</span></div>
                </button>
              );
            })}
          </div>
          {!plans.length && <p className="text-mute">Nenhum plano à venda. Cadastre em Planos.</p>}
        </Step>

        <Step n={3} title="Condições da venda">
          <div className="grid max-w-3xl gap-3 sm:grid-cols-3">
            <Field label="Mensalidade (R$)">
              <input name="price" value={price} onChange={(e) => setPrice(e.target.value)} className="field num" />
            </Field>
            <Field label="Taxa de instalação (R$)">
              <input name="installFee" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="0,00" className="field num" />
            </Field>
            <Field label="Vencimento">
              <select name="dueDay" value={dueDay} onChange={(e) => setDueDay(e.target.value)} className="field">
                {[5, 10, 15, 20, 25].map((d) => (
                  <option key={d} value={d}>Todo dia {d}</option>
                ))}
              </select>
            </Field>
            <Field label="Vendedor">
              <select name="sellerId" defaultValue={customer?.sellerId ?? ""} key={`s${customer?.id}`} className="field">
                <option value="">Venda direta</option>
                {sellers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Canal de venda">
              <select name="channel" defaultValue={customer?.source ?? ""} key={`c${customer?.id}`} className="field">
                <option value="">Não informado</option>
                {Object.entries(SOURCE).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Observações da venda">
              <input name="saleNotes" className="field" />
            </Field>
          </div>
        </Step>

        <Step n={4} title="Instalação">
          <input type="hidden" name="schedule" value={schedule} />
          <div className="flex max-w-md">
            <button type="button" onClick={() => setSchedule("agora")} className={tab(schedule === "agora")}>Agendar agora</button>
            <button type="button" onClick={() => setSchedule("depois")} className={`${tab(schedule === "depois")} -ml-px`}>Agendar depois</button>
          </div>
          {schedule === "agora" ? (
            <div className="grid max-w-md grid-cols-2 gap-3">
              <Field label="Data">
                <input name="day" type="date" value={day} onChange={(e) => setDay(e.target.value)} className="field" />
              </Field>
              <Field label="Técnico">
                <select name="installerId" className="field">
                  <option value="">Definir depois</option>
                  {installers.map((i) => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
              </Field>
            </div>
          ) : (
            <p className="text-[12px] text-mute">O pedido fica em Pedidos, na aba &quot;Novo&quot;, até a instalação ser agendada.</p>
          )}
        </Step>
      </div>

      <aside className="panel xl:sticky xl:top-6">
        <div className="panel-head">
          <span className="label">Resumo da venda</span>
        </div>
        <dl className="flex flex-col gap-3 p-4 text-[13px]">
          <Row k="Cliente" v={mode === "novo" ? "Novo cadastro" : customer?.name ?? "Selecione"} dim={mode === "existente" && !customer} />
          <Row k="Plano" v={plan?.name ?? "Selecione"} dim={!plan} />
          <Row k="Mensalidade" v={brl(parse(price))} mono />
          {plan && parse(price) !== plan.priceCents && <Row k="Tabela" v={`${brl(plan.priceCents)} (${parse(price) < plan.priceCents ? "desconto" : "acréscimo"} de ${brl(Math.abs(plan.priceCents - parse(price)))})`} dim />}
          <Row k="Taxa de instalação" v={brl(parse(fee))} mono />
          <Row k="Vencimento" v={`Dia ${dueDay}`} />
          <Row k="Instalação" v={schedule === "agora" ? (day ? fmtDate(day) : "Informe a data") : "A agendar"} />
        </dl>
        <div className="flex flex-col gap-2 border-t border-line p-4">
          <Submit busy="Registrando venda...">Fechar venda</Submit>
          <p className="text-[11px] text-dim">
            {schedule === "agora" ? "Cria o cadastro, o contrato e a visita de instalação. O contrato ativa quando o técnico concluir." : "Cria o cadastro e o pedido. O contrato nasce quando a instalação for agendada."}
          </p>
        </div>
      </aside>
    </ActionForm>
  );
}

function Row({ k, v, mono, dim }: { k: string; v: string; mono?: boolean; dim?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="label">{k}</dt>
      <dd className={`text-right ${mono ? "num" : ""} ${dim ? "text-mute" : ""}`}>{v}</dd>
    </div>
  );
}
