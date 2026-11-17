import Link from "next/link";
import { CustomerFields } from "@/components/customer-fields";
import { ActionForm, Submit } from "@/components/forms";
import { Page, PageHead, Panel } from "@/components/ui";
import { createCustomer } from "../../actions";
import { managerDb, sellersOf } from "../../data";

export default async function NewCustomerPage() {
  const sellers = await sellersOf(await managerDb());
  return (
    <Page>
      <PageHead kicker="Comercial · Clientes" title="Novo cliente">
        <Link href="/manager/clientes" className="btn">Cancelar</Link>
      </PageHead>
      <Panel title="Cadastro" meta="Sem venda agora — para vender, use Nova venda" className="max-w-[760px]">
        <ActionForm keep action={createCustomer} className="flex flex-col gap-3 p-4">
          <CustomerFields sellers={sellers} />
          <Submit busy="Cadastrando...">Cadastrar cliente</Submit>
        </ActionForm>
      </Panel>
    </Page>
  );
}
