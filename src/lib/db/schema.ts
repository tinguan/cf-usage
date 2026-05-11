import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const usageSnapshots = sqliteTable("usage_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  resource: text("resource").notNull(), // 'workers', 'r2', 'kv', 'd1', 'pages'
  capturedAt: integer("captured_at", { mode: "timestamp" }).notNull(),
  periodStart: text("period_start").notNull(), // ISO date string
  periodEnd: text("period_end").notNull(),
  metrics: text("metrics", { mode: "json" }).notNull(), // Record<string, number>
});

export const workerSnapshots = sqliteTable("worker_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  scriptName: text("script_name").notNull(),
  capturedAt: integer("captured_at", { mode: "timestamp" }).notNull(),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  requests: integer("requests").default(0),
  errors: integer("errors").default(0),
  subrequests: integer("subrequests").default(0),
  cpuTimeP50: real("cpu_time_p50").default(0),
  cpuTimeP99: real("cpu_time_p99").default(0),
});

export const alertRules = sqliteTable("alert_rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  resource: text("resource").notNull(),
  metric: text("metric").notNull(),
  thresholdPct: real("threshold_pct").notNull(), // 0-100
  active: integer("active", { mode: "boolean" }).default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const alertEvents = sqliteTable("alert_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ruleId: integer("rule_id").notNull(),
  resource: text("resource").notNull(),
  metric: text("metric").notNull(),
  usageValue: real("usage_value").notNull(),
  thresholdPct: real("threshold_pct").notNull(),
  actualPct: real("actual_pct").notNull(),
  firedAt: integer("fired_at", { mode: "timestamp" }).notNull(),
  notified: integer("notified", { mode: "boolean" }).default(false),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const billingHistory = sqliteTable("billing_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invoiceId: text("invoice_id").notNull().unique(),
  type: text("type").notNull(), // 'invoice' | 'credit'
  name: text("name"),
  billedOn: text("billed_on").notNull(), // ISO date
  amount: real("amount").notNull(),
  currency: text("currency").default("USD"),
  lineItems: text("line_items", { mode: "json" }),
  fetchedAt: integer("fetched_at", { mode: "timestamp" }).notNull(),
});
