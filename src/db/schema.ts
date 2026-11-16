import { doublePrecision, index, integer, jsonb, pgEnum, pgTable, serial, text, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["manager", "installer"]);
export const jobStatusEnum = pgEnum("job_status", ["pendente", "a_caminho", "em_andamento", "concluido"]);
export const jobTypeEnum = pgEnum("job_type", ["instalacao", "reparo"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull(),
  active: boolean("active").notNull().default(true),
});

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  phone: text("phone"),
  email: text("email"),
  document: text("document"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const jobs = pgTable(
  "jobs",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id").notNull().references(() => customers.id),
    installerId: integer("installer_id").references(() => users.id),
    type: jobTypeEnum("type").notNull().default("instalacao"),
    status: jobStatusEnum("status").notNull().default("pendente"),
    day: text("day").notNull(),
    windowStart: text("window_start"),
    windowEnd: text("window_end"),
    stopOrder: integer("stop_order"),
    etaAt: timestamp("eta_at", { withTimezone: true }),
    startedRouteAt: timestamp("started_route_at", { withTimezone: true }),
    arrivedAt: timestamp("arrived_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    orderId: integer("order_id"),
    ticketId: integer("ticket_id"),
    notes: text("notes"),
  },
  (t) => [index("jobs_installer_day_idx").on(t.installerId, t.day)],
);

export const locations = pgTable(
  "locations",
  {
    id: serial("id").primaryKey(),
    installerId: integer("installer_id").notNull().references(() => users.id),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    speed: doublePrecision("speed"),
    heading: doublePrecision("heading"),
    accuracy: doublePrecision("accuracy"),
    ts: timestamp("ts", { withTimezone: true }).notNull(),
  },
  (t) => [index("locations_installer_ts_idx").on(t.installerId, t.ts)],
);

export const livePositions = pgTable("live_positions", {
  installerId: integer("installer_id").primaryKey().references(() => users.id),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  speed: doublePrecision("speed"),
  heading: doublePrecision("heading"),
  ts: timestamp("ts", { withTimezone: true }).notNull(),
});

export const routes = pgTable(
  "routes",
  {
    id: serial("id").primaryKey(),
    installerId: integer("installer_id").notNull().references(() => users.id),
    day: text("day").notNull(),
    geometry: jsonb("geometry").$type<[number, number][]>().notNull(),
    distanceM: doublePrecision("distance_m").notNull(),
    durationS: doublePrecision("duration_s").notNull(),
  },
  (t) => [uniqueIndex("routes_installer_day_idx").on(t.installerId, t.day)],
);

export const techEnum = pgEnum("tech", ["fibra", "radio", "cabo"]);
export const contractStatusEnum = pgEnum("contract_status", ["aguardando_instalacao", "ativo", "suspenso", "cancelado"]);
export const orderTypeEnum = pgEnum("order_type", ["nova_assinatura", "mudanca_plano", "cancelamento"]);
export const orderStatusEnum = pgEnum("order_status", ["novo", "agendado", "concluido", "cancelado"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["aberta", "paga", "cancelada"]);
export const ticketCategoryEnum = pgEnum("ticket_category", ["sem_conexao", "lentidao", "financeiro", "equipamento", "outro"]);
export const ticketPriorityEnum = pgEnum("ticket_priority", ["baixa", "media", "alta"]);
export const ticketStatusEnum = pgEnum("ticket_status", ["aberto", "em_atendimento", "resolvido"]);

export const plans = pgTable("plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  downMbps: integer("down_mbps").notNull(),
  upMbps: integer("up_mbps").notNull(),
  priceCents: integer("price_cents").notNull(),
  tech: techEnum("tech").notNull().default("fibra"),
  active: boolean("active").notNull().default(true),
});

export const contracts = pgTable(
  "contracts",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id").notNull().references(() => customers.id),
    planId: integer("plan_id").notNull().references(() => plans.id),
    status: contractStatusEnum("status").notNull().default("aguardando_instalacao"),
    priceCents: integer("price_cents").notNull(),
    dueDay: integer("due_day").notNull().default(10),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (t) => [index("contracts_customer_idx").on(t.customerId)],
);

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  type: orderTypeEnum("type").notNull(),
  status: orderStatusEnum("status").notNull().default("novo"),
  planId: integer("plan_id").references(() => plans.id),
  contractId: integer("contract_id").references(() => contracts.id),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

export const invoices = pgTable(
  "invoices",
  {
    id: serial("id").primaryKey(),
    contractId: integer("contract_id").notNull().references(() => contracts.id),
    customerId: integer("customer_id").notNull().references(() => customers.id),
    competence: text("competence").notNull(),
    amountCents: integer("amount_cents").notNull(),
    dueDate: text("due_date").notNull(),
    status: invoiceStatusEnum("status").notNull().default("aberta"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("invoices_contract_competence_idx").on(t.contractId, t.competence)],
);

export const tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  subject: text("subject").notNull(),
  category: ticketCategoryEnum("category").notNull().default("outro"),
  priority: ticketPriorityEnum("priority").notNull().default("media"),
  status: ticketStatusEnum("status").notNull().default("aberto"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});
