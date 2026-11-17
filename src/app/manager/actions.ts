"use server";

import { and, eq, inArray, lt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import { geocode } from "@/lib/geocode";
import { requireRole } from "@/lib/session";
import { composeAddress, dueDateFor, today } from "@/lib/telecom";

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

const SOURCES = ["indicacao", "site", "redes_sociais", "porta_a_porta", "loja", "telefone", "outro"] as const;
const pick = <T extends string>(v: string, list: readonly T[]) => (list.includes(v as T) ? (v as T) : null);

function customerFields(fd: FormData) {
  const uf = str(fd, "uf").toUpperCase().slice(0, 2) || null;
  return {
    name: str(fd, "name"),
    personType: str(fd, "personType") === "pj" ? ("pj" as const) : ("pf" as const),
    document: opt(fd, "document"),
    birthDate: opt(fd, "birthDate"),
    phone: opt(fd, "phone"),
    phone2: opt(fd, "phone2"),
    email: opt(fd, "email"),
    zip: opt(fd, "zip"),
    street: opt(fd, "street"),
    number: opt(fd, "number"),
    complement: opt(fd, "complement"),
    neighborhood: opt(fd, "neighborhood"),
    city: opt(fd, "city"),
    uf,
    source: pick(str(fd, "source"), SOURCES),
    sellerId: int(fd, "sellerId"),
    notes: opt(fd, "notes"),
  };
}

async function locate(c: ReturnType<typeof customerFields>) {
  const tries = [
    [c.street, c.number, c.city, c.uf],
    [c.street, c.city, c.uf],
    [c.neighborhood, c.city, c.uf],
    [c.city, c.uf],
  ].map((parts) => parts.filter(Boolean).join(", "));
  for (const q of [...new Set(tries)].filter((q) => q.length > 3)) {
    const [hit] = await geocode(q, 1);
    if (hit) return hit;
  }
  return null;
}

export async function createCustomer(_: FormState, fd: FormData): Promise<FormState> {
  const db = await guard();
  const c = customerFields(fd);
  if (!c.name || !c.street || !c.city) return { error: "Nome, rua e cidade são obrigatórios." };
  let place;
  try {
    place = await locate(c);
  } catch {
    return { error: "Busca de endereço indisponível. Tente novamente." };
  }
  if (!place) return { error: "Cidade não localizada no mapa. Confira cidade e UF." };
  const [row] = await db
    .insert(schema.customers)
    .values({ ...c, address: composeAddress(c), lat: place.lat, lng: place.lng })
    .returning({ id: schema.customers.id });
  const planId = int(fd, "planId");
  if (planId) {
    const [plan] = await db.select().from(schema.plans).where(eq(schema.plans.id, planId));
    if (plan) await db.insert(schema.orders).values({ customerId: row.id, type: "nova_assinatura", planId, priceCents: plan.priceCents, sellerId: c.sellerId, channel: c.source });
  }
  refresh();
  redirect(`/manager/clientes/${row.id}`);
}

export async function updateCustomer(_: FormState, fd: FormData): Promise<FormState> {
  const db = await guard();
  const id = int(fd, "id");
  const c = customerFields(fd);
  if (!id || !c.name) return { error: "Nome é obrigatório." };
  const [old] = await db.select().from(schema.customers).where(eq(schema.customers.id, id));
  if (!old) return { error: "Cliente não encontrado." };
  const moved = (["street", "number", "neighborhood", "city", "uf", "zip"] as const).some((k) => (old[k] ?? null) !== c[k]);
  let geo = {};
  if (moved && c.street && c.city) {
    const place = await locate(c).catch(() => null);
    if (!place) return { error: "Cidade não localizada no mapa. Confira cidade e UF." };
    geo = { address: composeAddress(c), lat: place.lat, lng: place.lng };
  }
  await db.update(schema.customers).set({ ...c, ...geo }).where(eq(schema.customers.id, id));
  refresh();
  return { ok: moved ? "Dados e endereço atualizados." : "Dados salvos." };
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
  const [plan] = type !== "cancelamento" ? await db.select().from(schema.plans).where(eq(schema.plans.id, planId!)) : [];
  await db.insert(schema.orders).values({
    customerId,
    type,
    planId: plan?.id ?? null,
    priceCents: plan?.priceCents ?? null,
    contractId: type === "nova_assinatura" ? null : contractId,
    sellerId: int(fd, "sellerId"),
    channel: pick(str(fd, "channel"), SOURCES),
    installFeeCents: cents(str(fd, "installFee")) ?? 0,
    notes: opt(fd, "notes"),
  });
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
      .values({ customerId: o.customerId, planId: plan.id, priceCents: o.priceCents ?? plan.priceCents, dueDay: int(fd, "dueDay") ?? 10 })
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


const CHANNELS = ["telefone", "whatsapp", "email", "presencial", "visita"] as const;
const REASONS = ["venda", "suporte", "cobranca", "retencao", "cadastro", "outro"] as const;

export async function createInteraction(_: FormState, fd: FormData): Promise<FormState> {
  const session = await requireRole("manager");
  if (!session) throw new Error("Não autorizado");
  const customerId = int(fd, "customerId");
  const channel = pick(str(fd, "channel"), CHANNELS);
  const summary = str(fd, "summary");
  if (!customerId || !channel || !summary) return { error: "Informe canal e resumo do contato." };
  const followUpDate = str(fd, "followUpDate");
  await getDb().insert(schema.interactions).values({
    customerId,
    userId: session.uid,
    channel,
    reason: pick(str(fd, "reason"), REASONS) ?? "outro",
    summary,
    followUpDate: isDay(followUpDate) ? followUpDate : null,
  });
  refresh();
  return { ok: "Contato registrado." };
}

export async function completeFollowUp(fd: FormData) {
  const db = await guard();
  const id = int(fd, "id");
  if (id) await db.update(schema.interactions).set({ followUpDone: true }).where(eq(schema.interactions.id, id));
  refresh();
}

export async function saveSeller(_: FormState, fd: FormData): Promise<FormState> {
  const db = await guard();
  const name = str(fd, "name");
  const pct = Number(str(fd, "commissionPct").replace(",", "."));
  if (!name || !Number.isFinite(pct) || pct < 0 || pct > 100) return { error: "Informe nome e comissão entre 0 e 100%." };
  await db.insert(schema.sellers).values({ name, phone: opt(fd, "phone"), email: opt(fd, "email"), commissionPct: pct });
  refresh();
  return { ok: "Vendedor cadastrado." };
}

export async function toggleSeller(fd: FormData) {
  const db = await guard();
  const id = int(fd, "id");
  if (!id) return;
  const [v] = await db.select({ active: schema.sellers.active }).from(schema.sellers).where(eq(schema.sellers.id, id));
  if (v) await db.update(schema.sellers).set({ active: !v.active }).where(eq(schema.sellers.id, id));
  refresh();
}

export async function createSale(_: FormState, fd: FormData): Promise<FormState> {
  const db = await guard();
  const planId = int(fd, "planId");
  const [plan] = planId ? await db.select().from(schema.plans).where(eq(schema.plans.id, planId)) : [];
  if (!plan) return { error: "Escolha o plano." };
  const priceCents = str(fd, "price") ? cents(str(fd, "price")) : plan.priceCents;
  if (priceCents == null) return { error: "Mensalidade inválida." };
  const scheduleNow = str(fd, "schedule") === "agora";
  const day = str(fd, "day");
  if (scheduleNow && !isDay(day)) return { error: "Informe a data da instalação ou escolha agendar depois." };

  let customerId = int(fd, "customerId");
  let sellerId = int(fd, "sellerId");
  let channel = pick(str(fd, "channel"), SOURCES);
  if (str(fd, "mode") === "novo") {
    const c = customerFields(fd);
    c.sellerId = sellerId;
    c.source = channel;
    if (!c.name || !c.phone) return { error: "Informe nome e celular do cliente." };
    if (!c.street || !c.city) return { error: "Informe rua e cidade do endereço de instalação." };
    if (c.document) {
      const [dup] = await db.select({ id: schema.customers.id, name: schema.customers.name }).from(schema.customers).where(eq(schema.customers.document, c.document));
      if (dup) return { error: `Já existe um cliente com esse documento: ${dup.name}. Use "Cliente já cadastrado".` };
    }
    let place;
    try {
      place = await locate(c);
    } catch {
      return { error: "Busca de endereço indisponível no momento. Tente de novo em instantes." };
    }
    if (!place) return { error: "Cidade não localizada no mapa. Confira cidade e UF." };
    const [row] = await db.insert(schema.customers).values({ ...c, address: composeAddress(c), lat: place.lat, lng: place.lng }).returning({ id: schema.customers.id });
    customerId = row.id;
  } else {
    const [c] = customerId ? await db.select().from(schema.customers).where(eq(schema.customers.id, customerId)) : [];
    if (!c) return { error: "Selecione o cliente." };
    sellerId ??= c.sellerId;
    channel ??= c.source;
  }

  const [order] = await db
    .insert(schema.orders)
    .values({ customerId: customerId!, type: "nova_assinatura", planId: plan.id, priceCents, sellerId, channel, installFeeCents: cents(str(fd, "installFee")) ?? 0, notes: opt(fd, "saleNotes") })
    .returning({ id: schema.orders.id });
  if (scheduleNow) {
    const [contract] = await db
      .insert(schema.contracts)
      .values({ customerId: customerId!, planId: plan.id, priceCents, dueDay: int(fd, "dueDay") ?? 10 })
      .returning({ id: schema.contracts.id });
    await db.insert(schema.jobs).values({ customerId: customerId!, type: "instalacao", day, installerId: int(fd, "installerId"), orderId: order.id });
    await db.update(schema.orders).set({ status: "agendado", contractId: contract.id }).where(eq(schema.orders.id, order.id));
  }
  refresh();
  redirect(`/manager/clientes/${customerId}?t=pedidos&venda=${order.id}`);
}
