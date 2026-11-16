import { and, asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import { requireRole } from "@/lib/session";

export async function managerDb() {
  if (!(await requireRole("manager"))) redirect("/login");
  return getDb();
}

export const installersOf = (db: ReturnType<typeof getDb>) =>
  db
    .select({ id: schema.users.id, name: schema.users.name })
    .from(schema.users)
    .where(and(eq(schema.users.role, "installer"), eq(schema.users.active, true)))
    .orderBy(asc(schema.users.name));

export type Db = ReturnType<typeof getDb>;
