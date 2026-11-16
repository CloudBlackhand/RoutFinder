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
