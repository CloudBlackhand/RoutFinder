import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { dueDateFor } from "../lib/telecom";
import { getDb, schema } from "./index";

const CENTER = { lat: -23.5505, lng: -46.6333 };
const day = new Date().toISOString().slice(0, 10);
const names = ["Ana Souza", "Bruno Lima", "Carla Dias", "Diego Rocha", "Elisa Prado", "Fábio Alves", "Gabi Nunes", "Hugo Reis", "Iara Melo", "João Pires", "Karen Luz", "Leo Costa"];

const monthsBack = (n: number) => {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - n);
  return d.toISOString().slice(0, 7);
};

async function main() {
  const db = getDb();
  const hash = await bcrypt.hash("finder123", 10);
  await db.insert(schema.users).values([
    { name: "Gestor", email: "gestor@finder.dev", passwordHash: hash, role: "manager" },
    { name: "Marcos Instalador", email: "marcos@finder.dev", passwordHash: hash, role: "installer" },
    { name: "Paula Instaladora", email: "paula@finder.dev", passwordHash: hash, role: "installer" },
  ]).onConflictDoNothing();

  let custs = await db.select().from(schema.customers);
  if (!custs.length) {
    custs = await db.insert(schema.customers).values(
      names.map((name, i) => ({
        name,
        address: `Rua Exemplo ${100 + i * 7}, São Paulo`,
        lat: CENTER.lat + (Math.sin(i * 2.1) * 0.03),
        lng: CENTER.lng + (Math.cos(i * 1.7) * 0.04),
        phone: `1199999${String(1000 + i)}`,
      })),
    ).returning();
    await db.insert(schema.jobs).values(
      custs.map((c, i) => ({ customerId: c.id, day, type: i % 4 === 0 ? ("reparo" as const) : ("instalacao" as const) })),
    );
  }

  if (!(await db.select().from(schema.plans)).length) {
    const plans = await db.insert(schema.plans).values([
      { name: "Fibra 300 Mega", downMbps: 300, upMbps: 150, priceCents: 9990 },
      { name: "Fibra 500 Mega", downMbps: 500, upMbps: 250, priceCents: 11990 },
      { name: "Fibra 1 Giga", downMbps: 1000, upMbps: 500, priceCents: 15990 },
      { name: "Rádio 50 Mega", downMbps: 50, upMbps: 25, priceCents: 7990, tech: "radio" },
    ]).returning();

    for (const [i, c] of custs.entries()) {
      await db.update(schema.customers).set({
        email: c.email ?? `${c.name.split(" ")[0].toLowerCase()}@exemplo.com.br`,
        document: c.document ?? `${String(100 + i * 37).padStart(3, "0")}.${String(200 + i * 11)}.${String(300 + i * 7)}-${String(10 + i)}`,
      }).where(eq(schema.customers.id, c.id));
    }

    const subscribed = custs.slice(0, 9);
    const contracts = await db.insert(schema.contracts).values(
      subscribed.map((c, i) => {
        const p = plans[i % 3];
        return { customerId: c.id, planId: p.id, priceCents: p.priceCents, dueDay: [5, 10, 15][i % 3], status: "ativo" as const, activatedAt: new Date(Date.now() - (90 + i * 20) * 86_400_000) };
      }),
    ).returning();

    const comps = [monthsBack(2), monthsBack(1), monthsBack(0)];
    const today = new Date().toISOString().slice(0, 10);
    await db.insert(schema.invoices).values(
      contracts.flatMap((k, i) =>
        comps.map((competence, m) => {
          const dueDate = dueDateFor(competence, k.dueDay);
          const late = (i === 2 || i === 6) && m >= 1;
          const paid = dueDate < today && !late;
          return { contractId: k.id, customerId: k.customerId, competence, amountCents: k.priceCents, dueDate, status: paid ? ("paga" as const) : ("aberta" as const), paidAt: paid ? new Date(`${dueDate}T15:00:00Z`) : null };
        }),
      ),
    );

    await db.insert(schema.orders).values([
      { customerId: custs[9].id, type: "nova_assinatura", planId: plans[1].id, notes: "Indicação de vizinho" },
      { customerId: custs[10].id, type: "nova_assinatura", planId: plans[0].id },
      { customerId: subscribed[0].id, type: "mudanca_plano", planId: plans[2].id, contractId: contracts[0].id, notes: "Quer upgrade para home office" },
    ]);

    await db.insert(schema.tickets).values([
      { customerId: subscribed[1].id, subject: "Internet caindo à noite", category: "lentidao", priority: "media", description: "Quedas frequentes após 20h" },
      { customerId: subscribed[3].id, subject: "Sem sinal desde ontem", category: "sem_conexao", priority: "alta", description: "LOS vermelho na ONU" },
      { customerId: subscribed[4].id, subject: "Segunda via do boleto", category: "financeiro", priority: "baixa" },
    ]);
  }

  console.log("Seed ok. Logins: gestor@finder.dev / marcos@finder.dev / paula@finder.dev, senha finder123");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
