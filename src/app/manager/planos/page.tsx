import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { schema } from "@/db";
import { ActionForm, Submit } from "@/components/forms";
import { Act, Empty, Field, Page, PageHead, Panel, Status } from "@/components/ui";
import { TECH, brl } from "@/lib/telecom";
import { savePlan, togglePlan } from "../actions";
import { managerDb } from "../data";

export default async function PlansPage(props: PageProps<"/manager/planos">) {
  const { edit } = (await props.searchParams) as { edit?: string };
  const db = await managerDb();
  const [plans, contracts] = await Promise.all([
    db.select().from(schema.plans).orderBy(asc(schema.plans.priceCents)),
    db.select({ planId: schema.contracts.planId, priceCents: schema.contracts.priceCents }).from(schema.contracts).where(eq(schema.contracts.status, "ativo")),
  ]);
  const editing = plans.find((p) => p.id === Number(edit));
  const totalMrr = contracts.reduce((s, c) => s + c.priceCents, 0);

  return (
    <Page>
      <PageHead kicker="Comercial" title="Planos" />

      <div className="grid items-start gap-5 xl:grid-cols-[1fr_340px]">
        <Panel title="Catálogo" meta={`${plans.filter((p) => p.active).length} à venda`}>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Plano</th>
                  <th>Tecnologia</th>
                  <th className="text-right">Velocidade</th>
                  <th className="text-right">Mensalidade</th>
                  <th className="text-right">Assinantes</th>
                  <th className="text-right">Receita/mês</th>
                  <th className="w-40">Participação</th>
                  <th>Situação</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => {
                  const subs = contracts.filter((c) => c.planId === p.id);
                  const mrr = subs.reduce((s, c) => s + c.priceCents, 0);
                  const share = totalMrr ? mrr / totalMrr : 0;
                  return (
                    <tr key={p.id} className={p.active ? "" : "opacity-60"}>
                      <td className="font-medium">{p.name}</td>
                      <td>{TECH[p.tech]}</td>
                      <td className="num text-right">
                        {p.downMbps}
                        <span className="text-mute">/{p.upMbps} Mbps</span>
                      </td>
                      <td className="num text-right">{brl(p.priceCents)}</td>
                      <td className="num text-right">{subs.length}</td>
                      <td className="num text-right">{brl(mrr)}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 bg-raised">
                            <div className="h-full bg-fg" style={{ width: `${share * 100}%` }} />
                          </div>
                          <span className="num w-9 text-right text-[11px] text-mute">{Math.round(share * 100)}%</span>
                        </div>
                      </td>
                      <td>{p.active ? <Status label="À venda" color="#22c55e" /> : <Status label="Descontinuado" color="#71717a" />}</td>
                      <td className="text-right">
                        <div className="inline-flex gap-1">
                          <Link href={`/manager/planos?edit=${p.id}`} className="btn btn-sm">Editar</Link>
                          <Act action={togglePlan} fields={{ id: p.id }}>{p.active ? "Descontinuar" : "Reativar"}</Act>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!plans.length && <Empty cols={9} text="Nenhum plano cadastrado." />}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title={editing ? `Editar plano #${editing.id}` : "Novo plano"} meta={editing && <Link href="/manager/planos" className="hover:text-fg">Cancelar</Link>}>
          <ActionForm keep={!!editing} key={editing?.id ?? "new"} action={savePlan} className="flex flex-col gap-3 p-3">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <Field label="Nome comercial">
              <input name="name" required defaultValue={editing?.name} placeholder="Fibra 500 Mega" className="field" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Download (Mbps)">
                <input name="downMbps" type="number" min={1} required defaultValue={editing?.downMbps} className="field" />
              </Field>
              <Field label="Upload (Mbps)">
                <input name="upMbps" type="number" min={1} required defaultValue={editing?.upMbps} className="field" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mensalidade (R$)">
                <input name="price" required defaultValue={editing ? (editing.priceCents / 100).toFixed(2).replace(".", ",") : ""} placeholder="99,90" className="field" />
              </Field>
              <Field label="Tecnologia">
                <select name="tech" defaultValue={editing?.tech ?? "fibra"} className="field">
                  {Object.entries(TECH).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Submit>{editing ? "Salvar plano" : "Criar plano"}</Submit>
            {editing && <p className="text-[11px] text-dim">A nova mensalidade vale para novas assinaturas e mudanças de plano. Contratos vigentes mantêm o valor contratado.</p>}
          </ActionForm>
        </Panel>
      </div>
    </Page>
  );
}
