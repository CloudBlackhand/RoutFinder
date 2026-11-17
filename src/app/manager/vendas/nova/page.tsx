import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { schema } from "@/db";
import { Page, PageHead } from "@/components/ui";
import { shiftDay, today } from "@/lib/telecom";
import { installersOf, managerDb, sellersOf } from "../../data";
import { SaleForm } from "./sale-form";

export default async function NewSalePage(props: PageProps<"/manager/vendas/nova">) {
  const { c } = (await props.searchParams) as { c?: string };
  const db = await managerDb();
  const [customers, plans, sellers, installers] = await Promise.all([
    db
      .select({ id: schema.customers.id, name: schema.customers.name, document: schema.customers.document, phone: schema.customers.phone, address: schema.customers.address, sellerId: schema.customers.sellerId, source: schema.customers.source })
      .from(schema.customers)
      .orderBy(asc(schema.customers.name)),
    db.select().from(schema.plans).where(eq(schema.plans.active, true)).orderBy(asc(schema.plans.priceCents)),
    sellersOf(db),
    installersOf(db),
  ]);
  const preselect = customers.find((x) => x.id === Number(c))?.id ?? null;

  return (
    <Page>
      <PageHead kicker="Comercial · Vendas" title="Nova venda">
        <Link href="/manager/vendas" className="btn">Cancelar</Link>
      </PageHead>
      <SaleForm customers={customers} plans={plans} sellers={sellers} installers={installers} preselect={preselect} tomorrow={shiftDay(today(), 1)} />
    </Page>
  );
}
