"use server";

import { and, eq, inArray, lt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import { geocode } from "@/lib/geocode";
import { requireRole } from "@/lib/session";
import { dueDateFor, today } from "@/lib/telecom";

export type FormState = { error?: string; ok?: string } | null;

async function guard() {
  if (!(await requireRole("manager"))) throw new Error("Não autorizado");
  return getDb();
}
const refresh = () => revalidatePath("/manager", "layout");
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const opt = (fd: FormData, k: string) => str(fd, k) || null;
const int = (fd: FormData, k: string) => {
  const n = Number(str(fd, k));
  return str(fd, k) && Number.isInteger(n) ? n : null;
};
const cents = (v: string) => {
  const n = Number(v.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
};
const isDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

export async function createCustomer(_: FormState, fd: FormData): Promise<FormState> {
  const db = await guard();
  const name = str(fd, "name");
  const address = str(fd, "address");
  if (!name || !address) return { error: "Nome e endereço são obrigatórios." };
  let place;
  try {
    [place] = await geocode(address, 1);
  } catch {
    return { error: "Busca de endereço indisponível. Tente novamente." };
  }
  if (!place) return { error: "Endereço não encontrado. Inclua número, cidade e estado." };
  const [c] = await db
    .insert(schema.customers)
    .values({ name, address: place.label, lat: place.lat, lng: place.lng, phone: opt(fd, "phone"), email: opt(fd, "email"), document: opt(fd, "document"), notes: opt(fd, "notes") })
    .returning({ id: schema.customers.id });
  const planId = int(fd, "planId");
  if (planId) await db.insert(schema.orders).values({ customerId: c.id, type: "nova_assinatura", planId });
  refresh();
  redirect(`/manager/clientes/${c.id}`);
}

export async function updateCustomer(_: FormState, fd: FormData): Promise<FormState> {
  const db = await guard();
  const id = int(fd, "id");
  const name = str(fd, "name");
  if (!id || !name) return { error: "Nome é obrigatório." };
  await db
    .update(schema.customers)
    .set({ name, phone: opt(fd, "phone"), email: opt(fd, "email"), document: opt(fd, "document"), notes: opt(fd, "notes") })
    .where(eq(schema.customers.id, id));
  refresh();
  return { ok: "Dados salvos." };
}

export async function savePlan(_: FormState, fd: FormData): Promise<FormState> {
  const db = await guard();
  const name = str(fd, "name");
  const downMbps = int(fd, "downMbps");
  const upMbps = int(fd, "upMbps");
  const priceCents = cents(str(fd, "price"));
  const tech = str(fd, "tech") as "fibra" | "radio" | "cabo";
  if (!name || !downMbps || !upMbps || priceCents == null || !["fibra", "radio", "cabo"].includes(tech)) return { error: "Preencha todos os campos corretamente." };
  const id = int(fd, "id");
  const values = { name, downMbps, upMbps, priceCents, tech };
  if (id) await db.update(schema.plans).set(values).where(eq(schema.plans.id, id));
  else await db.insert(schema.plans).values(values);
  refresh();
  return { ok: id ? "Plano atualizado." : "Plano criado." };
}

export async function togglePlan(fd: FormData) {
  const db = await guard();
  const id = int(fd, "id");
  if (!id) return;
  const [p] = await db.select({ active: schema.plans.active }).from(schema.plans).where(eq(schema.plans.id, id));
  if (p) await db.update(schema.plans).set({ active: !p.active }).where(eq(schema.plans.id, id));
  refresh();
}

export async function createOrder(_: FormState, fd: FormData): Promise<FormState> {
  const db = await guard();
  const customerId = int(fd, "customerId");
  const type = str(fd, "type") as "nova_assinatura" | "mudanca_plano" | "cancelamento";
  const planId = int(fd, "planId");
  const contractId = int(fd, "contractId");
  if (!customerId || !["nova_assinatura", "mudanca_plano", "cancelamento"].includes(type)) return { error: "Selecione cliente e tipo." };
  if (type !== "cancelamento" && !planId) return { error: "Selecione o plano." };
  if (type !== "nova_assinatura" && !contractId) return { error: "Selecione o contrato." };
  await db.insert(schema.orders).values({ customerId, type, planId: type === "cancelamento" ? null : planId, contractId: type === "nova_assinatura" ? null : contractId, notes: opt(fd, "notes") });
  refresh();
  return { ok: "Pedido registrado." };
}

export async function processOrder(_: FormState, fd: FormData): Promise<FormState> {
  const db = await guard();
  const id = int(fd, "id");
  const [o] = id ? await db.select().from(schema.orders).where(eq(schema.orders.id, id)) : [];
  if (!o || o.status !== "novo") return { error: "Pedido não está aberto." };
  const now = new Date();

  if (o.type === "nova_assinatura") {
    const day = str(fd, "day");
    if (!isDay(day)) return { error: "Informe a data da instalação." };
    const [plan] = await db.select().from(schema.plans).where(eq(schema.plans.id, o.planId!));
    const [contract] = await db
      .insert(schema.contracts)
      .values({ customerId: o.customerId, planId: plan.id, priceCents: plan.priceCents, dueDay: int(fd, "dueDay") ?? 10 })
      .returning({ id: schema.contracts.id });
    await db.insert(schema.jobs).values({ customerId: o.customerId, type: "instalacao", day, installerId: int(fd, "installerId"), orderId: o.id });
    await db.update(schema.orders).set({ status: "agendado", contractId: contract.id }).where(eq(schema.orders.id, o.id));
  } else if (o.type === "mudanca_plano") {
    const [plan] = await db.select().from(schema.plans).where(eq(schema.plans.id, o.planId!));
    await db.update(schema.contracts).set({ planId: plan.id, priceCents: plan.priceCents }).where(eq(schema.contracts.id, o.contractId!));
    await db.update(schema.orders).set({ status: "concluido", closedAt: now }).where(eq(schema.orders.id, o.id));
  } else {
    await db.update(schema.contracts).set({ status: "cancelado", cancelledAt: now }).where(eq(schema.contracts.id, o.contractId!));
    await db.update(schema.orders).set({ status: "concluido", closedAt: now }).where(eq(schema.orders.id, o.id));
  }
  refresh();
  return { ok: o.type === "nova_assinatura" ? "Instalação agendada." : "Pedido concluído." };
}

export async function cancelOrder(fd: FormData) {
  const db = await guard();
  const id = int(fd, "id");
  if (id) await db.update(schema.orders).set({ status: "cancelado", closedAt: new Date() }).where(and(eq(schema.orders.id, id), eq(schema.orders.status, "novo")));
  refresh();
}

export async function setContractStatus(fd: FormData) {
  const db = await guard();
  const id = int(fd, "id");
  const status = str(fd, "status");
  if (!id || !["ativo", "suspenso", "cancelado"].includes(status)) return;
  await db
    .update(schema.contracts)
    .set({ status: status as "ativo" | "suspenso" | "cancelado", ...(status === "cancelado" ? { cancelledAt: new Date() } : {}) })
    .where(eq(schema.contracts.id, id));
  refresh();
}

export async function generateInvoices(_: FormState, fd: FormData): Promise<FormState> {
  const db = await guard();
  const competence = str(fd, "competence");
  if (!/^\d{4}-\d{2}$/.test(competence)) return { error: "Competência inválida." };
  const active = await db.select().from(schema.contracts).where(eq(schema.contracts.status, "ativo"));
  if (!active.length) return { error: "Nenhum contrato ativo." };
  const rows = await db
    .insert(schema.invoices)
    .values(active.map((c) => ({ contractId: c.id, customerId: c.customerId, competence, amountCents: c.priceCents, dueDate: dueDateFor(competence, c.dueDay) })))
    .onConflictDoNothing()
    .returning({ id: schema.invoices.id });
  refresh();
  return { ok: rows.length ? `${rows.length} fatura(s) gerada(s).` : "Todas as faturas dessa competência já existiam." };
}

export async function payInvoice(fd: FormData) {
  const db = await guard();
  const id = int(fd, "id");
  if (!id) return;
  const [inv] = await db.update(schema.invoices).set({ status: "paga", paidAt: new Date() }).where(eq(schema.invoices.id, id)).returning();
  if (inv) {
    const overdue = await db
      .select({ id: schema.invoices.id })
      .from(schema.invoices)
      .where(and(eq(schema.invoices.contractId, inv.contractId), eq(schema.invoices.status, "aberta"), lt(schema.invoices.dueDate, today())));
    if (!overdue.length)
      await db.update(schema.contracts).set({ status: "ativo" }).where(and(eq(schema.contracts.id, inv.contractId), eq(schema.contracts.status, "suspenso")));
  }
  refresh();
}

export async function cancelInvoice(fd: FormData) {
  const db = await guard();
  const id = int(fd, "id");
  if (id) await db.update(schema.invoices).set({ status: "cancelada" }).where(and(eq(schema.invoices.id, id), eq(schema.invoices.status, "aberta")));
  refresh();
}

export async function suspendOverdue(_: FormState, fd: FormData): Promise<FormState> {
  const db = await guard();
  const days = int(fd, "days") ?? 15;
  const limit = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const late = await db
    .select({ contractId: schema.invoices.contractId })
    .from(schema.invoices)
    .where(and(eq(schema.invoices.status, "aberta"), lt(schema.invoices.dueDate, limit)));
  const ids = [...new Set(late.map((l) => l.contractId))];
  const rows = ids.length
    ? await db.update(schema.contracts).set({ status: "suspenso" }).where(and(inArray(schema.contracts.id, ids), eq(schema.contracts.status, "ativo"))).returning({ id: schema.contracts.id })
    : [];
  refresh();
  return { ok: `${rows.length} contrato(s) suspenso(s).` };
}

export async function createTicket(_: FormState, fd: FormData): Promise<FormState> {
  const db = await guard();
  const customerId = int(fd, "customerId");
  const subject = str(fd, "subject");
  if (!customerId || !subject) return { error: "Cliente e assunto são obrigatórios." };
  await db.insert(schema.tickets).values({
    customerId,
    subject,
    category: (str(fd, "category") || "outro") as "outro",
    priority: (str(fd, "priority") || "media") as "media",
    description: opt(fd, "description"),
  });
  refresh();
  return { ok: "Chamado aberto." };
}

export async function setTicketStatus(fd: FormData) {
  const db = await guard();
  const id = int(fd, "id");
  const status = str(fd, "status");
  if (!id || !["aberto", "em_atendimento", "resolvido"].includes(status)) return;
  await db
    .update(schema.tickets)
    .set({ status: status as "aberto", resolvedAt: status === "resolvido" ? new Date() : null })
    .where(eq(schema.tickets.id, id));
  refresh();
}

export async function scheduleVisit(_: FormState, fd: FormData): Promise<FormState> {
  const db = await guard();
  const id = int(fd, "id");
  const day = str(fd, "day");
  if (!id || !isDay(day)) return { error: "Informe a data da visita." };
  const [t] = await db.select().from(schema.tickets).where(eq(schema.tickets.id, id));
  if (!t) return { error: "Chamado não encontrado." };
  await db.insert(schema.jobs).values({ customerId: t.customerId, type: "reparo", day, installerId: int(fd, "installerId"), ticketId: t.id, notes: t.subject });
  await db.update(schema.tickets).set({ status: "em_atendimento" }).where(eq(schema.tickets.id, id));
  refresh();
  return { ok: "Visita técnica agendada." };
}

export async function updateJob(fd: FormData) {
  const db = await guard();
  const id = int(fd, "id");
  const day = str(fd, "day");
  if (!id) return;
  await db
    .update(schema.jobs)
    .set({ installerId: int(fd, "installerId"), stopOrder: null, ...(isDay(day) ? { day } : {}) })
    .where(and(eq(schema.jobs.id, id), eq(schema.jobs.status, "pendente")));
  refresh();
}
