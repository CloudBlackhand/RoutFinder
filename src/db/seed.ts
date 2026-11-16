import "dotenv/config";
import bcrypt from "bcryptjs";
import { getDb, schema } from "./index";

const CENTER = { lat: -23.5505, lng: -46.6333 };
const day = new Date().toISOString().slice(0, 10);
const names = ["Ana Souza", "Bruno Lima", "Carla Dias", "Diego Rocha", "Elisa Prado", "Fábio Alves", "Gabi Nunes", "Hugo Reis", "Iara Melo", "João Pires", "Karen Luz", "Leo Costa"];

async function main() {
  const db = getDb();
  const hash = await bcrypt.hash("finder123", 10);
  await db.insert(schema.users).values([
    { name: "Gestor", email: "gestor@finder.dev", passwordHash: hash, role: "manager" },
    { name: "Marcos Instalador", email: "marcos@finder.dev", passwordHash: hash, role: "installer" },
    { name: "Paula Instaladora", email: "paula@finder.dev", passwordHash: hash, role: "installer" },
  ]).onConflictDoNothing();

  const custs = await db.insert(schema.customers).values(
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
  console.log("Seed ok. Logins: gestor@finder.dev / marcos@finder.dev / paula@finder.dev, senha finder123");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
