import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { schema } from "@/db";
import { ActionForm, Submit } from "@/components/forms";
import { Act, Empty, Page, PageHead, Tabs } from "@/components/ui";
import { ORDER, ORDER_TYPE, brl, fmtDate, shiftDay, today, type OrderStatus } from "@/lib/telecom";
import { cancelOrder, processOrder } from "../actions";
import { installersOf, managerDb } from "../data";

const FILTERS: OrderStatus[] = ["novo", "agendado", "concluido", "cancelado"];

export default async function OrdersPage(props: PageProps<"/manager/pedidos">) {
  const { s } = (await props.searchParams) as { s?: string };
  const status = FILTERS.includes(s as OrderStatus) ? (s as OrderStatus) : "novo";
  const db = await managerDb();
  const [orders, installers] = await Promise.all([
    db
      .select({ o: schema.orders, customer: schema.customers.name, address: schema.customers.address, plan: schema.plans.name, price: schema.plans.priceCents })
      .from(schema.orders)
      .innerJoin(schema.customers, eq(schema.customers.id, schema.orders.customerId))
      .leftJoin(schema.plans, eq(schema.plans.id, schema.orders.planId))
      .orderBy(desc(schema.orders.createdAt)),
    installersOf(db),
  ]);
  const rows = orders.filter((r) => r.o.status === status);
  const tomorrow = shiftDay(today(), 1);

  return (
    <Page>
      <PageHead kicker="Comercial" title="Pedidos">
        <Link href="/manager/vendas/nova" className="btn btn-primary">Nova venda</Link>
      </PageHead>

      <div className="flex flex-col gap-5">
        <section className="panel min-w-0">
          <Tabs active={`/manager/pedidos?s=${status}`} items={FILTERS.map((f) => ({ href: `/manager/pedidos?s=${f}`, label: ORDER[f].label, count: orders.filter((r) => r.o.status === f).length }))} />
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Cliente</th>
                  <th>Pedido</th>
                  <th>Aberto em</th>
                  <th>{status === "novo" ? "Ação" : ""}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ o, customer, address, plan, price }) => (
                  <tr key={o.id}>
                    <td className="num text-mute">{o.id}</td>
                    <td>
                      <Link href={`/manager/clientes/${o.customerId}`} className="font-medium hover:underline">{customer}</Link>
                      <div className="max-w-[260px] truncate text-[12px] text-mute">{address}</div>
                    </td>
                    <td className="min-w-[220px]">
                      {ORDER_TYPE[o.type]}
                      <div className="text-[12px] text-mute">
                        {plan ? `${plan} · ${brl(o.priceCents ?? price!)}` : `Contrato #${o.contractId}`}
                        {o.notes && ` · ${o.notes}`}
                      </div>
                    </td>
                    <td className="num text-mute">{fmtDate(o.createdAt)}</td>
                    <td>
                      {o.status === "novo" && (
                        <div className="flex items-center gap-1 whitespace-nowrap">
                          <ActionForm action={processOrder} className="flex items-center gap-1">
                            <input type="hidden" name="id" value={o.id} />
                            {o.type === "nova_assinatura" ? (
                              <>
                                <input name="day" type="date" min={today()} defaultValue={tomorrow} className="field h-[26px] w-[132px] px-2 text-[12px]" />
                                <select name="installerId" className="field h-[26px] w-[140px] px-2 text-[12px]">
                                  <option value="">Sem instalador</option>
                                  {installers.map((i) => (
                                    <option key={i.id} value={i.id}>{i.name}</option>
                                  ))}
                                </select>
                                <select name="dueDay" defaultValue="10" title="Dia de vencimento" className="field h-[26px] w-[74px] px-2 text-[12px]">
                                  {[5, 10, 15, 20, 25].map((d) => (
                                    <option key={d} value={d}>Dia {d}</option>
                                  ))}
                                </select>
                                <Submit className="btn btn-sm btn-primary">Agendar instalação</Submit>
                              </>
                            ) : (
                              <Submit className="btn btn-sm btn-primary">{o.type === "cancelamento" ? "Confirmar cancelamento" : "Aplicar mudança"}</Submit>
                            )}
                          </ActionForm>
                          <Act action={cancelOrder} fields={{ id: o.id }} className="btn btn-sm btn-danger">Recusar</Act>
                        </div>
                      )}
                      {o.closedAt && <span className="num text-[12px] text-mute">Fechado em {fmtDate(o.closedAt)}</span>}
                    </td>
                  </tr>
                ))}
                {!rows.length && <Empty cols={5} text={`Nenhum pedido ${ORDER[status].label.toLowerCase()}.`} />}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </Page>
  );
}
