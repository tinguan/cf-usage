import { AppDB } from "@/lib/db";
import {
  usageSnapshots,
  workerSnapshots,
  billingHistory,
} from "@/lib/db/schema";
import {
  getWorkersUsage,
  getR2Usage,
  getKVUsage,
  getD1Usage,
} from "@/lib/cloudflare/graphql";
import { getBillingHistory } from "@/lib/cloudflare/rest";
import { env } from "@/lib/env";
import { desc, eq, sql } from "drizzle-orm";

function periodRange(daysBack = 30) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - daysBack);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export async function syncWorkersUsage(db: AppDB): Promise<void> {
  const { start, end } = periodRange(30);
  const e = env();
  const { aggregate, scripts } = await getWorkersUsage(
    e.CF_API_TOKEN,
    e.CF_ACCOUNT_ID,
    start,
    end
  );

  const now = new Date();

  await db.insert(usageSnapshots).values({
    resource: "workers",
    capturedAt: now,
    periodStart: start,
    periodEnd: end,
    metrics: aggregate as unknown as string,
  });

  if (scripts.length > 0) {
    // Use raw SQL to avoid Drizzle D1 passing null for AUTOINCREMENT id
    for (const s of scripts) {
      const ts = Math.floor(now.getTime() / 1000);
      await db.run(sql`INSERT INTO worker_snapshots (script_name, captured_at, period_start, period_end, requests, errors, subrequests, cpu_time_p50, cpu_time_p99) VALUES (${s.scriptName}, ${ts}, ${start}, ${end}, ${s.requests}, ${s.errors}, ${0}, ${s.cpuTimeP50}, ${s.cpuTimeP99})`);
    }
  }
}

export async function syncR2Usage(db: AppDB): Promise<void> {
  const { start, end } = periodRange(30);
  const e = env();
  const usage = await getR2Usage(e.CF_API_TOKEN, e.CF_ACCOUNT_ID, start, end);
  await db.insert(usageSnapshots).values({
    resource: "r2",
    capturedAt: new Date(),
    periodStart: start,
    periodEnd: end,
    metrics: usage as unknown as string,
  });
}

export async function syncKVUsage(db: AppDB): Promise<void> {
  const { start, end } = periodRange(30);
  const e = env();
  const usage = await getKVUsage(e.CF_API_TOKEN, e.CF_ACCOUNT_ID, start, end);
  await db.insert(usageSnapshots).values({
    resource: "kv",
    capturedAt: new Date(),
    periodStart: start,
    periodEnd: end,
    metrics: usage as unknown as string,
  });
}

export async function syncD1Usage(db: AppDB): Promise<void> {
  const { start, end } = periodRange(30);
  const e = env();
  const usage = await getD1Usage(e.CF_API_TOKEN, e.CF_ACCOUNT_ID, start, end);
  await db.insert(usageSnapshots).values({
    resource: "d1",
    capturedAt: new Date(),
    periodStart: start,
    periodEnd: end,
    metrics: usage as unknown as string,
  });
}

export async function syncBillingHistory(db: AppDB): Promise<void> {
  const e = env();
  const entries = await getBillingHistory(e.CF_API_TOKEN, e.CF_ACCOUNT_ID);

  const now = new Date();
  for (const entry of entries) {
    try {
      // Use raw SQL to avoid Drizzle D1 passing null for AUTOINCREMENT id
      const ts = Math.floor(now.getTime() / 1000);
      await db.run(sql`INSERT OR IGNORE INTO billing_history (invoice_id, type, name, billed_on, amount, currency, line_items, fetched_at) VALUES (${entry.id}, ${entry.type}, ${entry.description ?? null}, ${entry.occurred_at}, ${entry.amount}, ${entry.currency ?? 'USD'}, ${null}, ${ts})`);
    } catch {
      // skip on error
    }
  }
}

export async function getLatestSnapshot(db: AppDB, resource: string) {
  const rows = await db
    .select()
    .from(usageSnapshots)
    .where(eq(usageSnapshots.resource, resource))
    .orderBy(desc(usageSnapshots.capturedAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function getLatestWorkerSnapshots(db: AppDB) {
  const latest = await db
    .select()
    .from(workerSnapshots)
    .orderBy(desc(workerSnapshots.capturedAt))
    .limit(1);

  if (!latest[0]) return [];

  const latestTime = latest[0].capturedAt;

  return db
    .select()
    .from(workerSnapshots)
    .where(eq(workerSnapshots.capturedAt, latestTime))
    .orderBy(desc(workerSnapshots.requests));
}

export async function syncAll(db: AppDB): Promise<{
  success: string[];
  errors: { resource: string; error: string }[];
}> {
  const success: string[] = [];
  const errors: { resource: string; error: string }[] = [];

  const tasks: { name: string; fn: () => Promise<void> }[] = [
    { name: "workers", fn: () => syncWorkersUsage(db) },
    { name: "r2", fn: () => syncR2Usage(db) },
    { name: "kv", fn: () => syncKVUsage(db) },
    { name: "d1", fn: () => syncD1Usage(db) },
    { name: "billing", fn: () => syncBillingHistory(db) },
  ];

  for (const task of tasks) {
    try {
      await task.fn();
      success.push(task.name);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ resource: task.name, error: msg });
      console.error(`[sync] ${task.name} FAILED:`, msg);
    }
  }

  return { success, errors };
}

