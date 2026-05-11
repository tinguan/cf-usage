import { AppDB } from "@/lib/db";
import {
  usageSnapshots,
  workerSnapshots,
  billingHistory,
  settings,
  queueSnapshots,
} from "@/lib/db/schema";
import {
  getWorkersUsage,
  getR2Usage,
  getKVUsage,
  getD1Usage,
  getQueuesUsage,
} from "@/lib/cloudflare/graphql";
import { getBillingHistory, getD1Databases, getQueues } from "@/lib/cloudflare/rest";
import { env } from "@/lib/env";
import { desc, eq, sql } from "drizzle-orm";

export async function getLastSyncTime(db: AppDB): Promise<Date | null> {
  const rows = await db
    .select()
    .from(usageSnapshots)
    .orderBy(desc(usageSnapshots.capturedAt))
    .limit(1);
  return rows[0]?.capturedAt ?? null;
}

export async function getSyncIntervalHours(db: AppDB): Promise<number> {
  const rows = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "sync_interval_hours"))
    .limit(1);
  return parseFloat((rows[0]?.value as string) ?? "1");
}

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
      await db.run(sql`INSERT INTO worker_snapshots (script_name, captured_at, period_start, period_end, requests, errors, subrequests, cpu_time_p50, cpu_time_p99) VALUES (${s.scriptName}, ${ts}, ${start}, ${end}, ${s.requests}, ${s.errors}, ${s.subrequests}, ${s.cpuTimeP50}, ${s.cpuTimeP99})`);
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
  const [graphqlResult, dbsResult] = await Promise.allSettled([
    getD1Usage(e.CF_API_TOKEN, e.CF_ACCOUNT_ID, start, end),
    getD1Databases(e.CF_API_TOKEN, e.CF_ACCOUNT_ID),
  ]);
  if (graphqlResult.status === "rejected") throw graphqlResult.reason;
  const graphql = graphqlResult.value;
  const storageGB =
    dbsResult.status === "fulfilled"
      ? dbsResult.value.reduce((sum, d) => sum + (d.file_size ?? 0), 0) /
        1_073_741_824
      : 0; // token may lack d1:read for database list — fall back to 0
  await db.insert(usageSnapshots).values({
    resource: "d1",
    capturedAt: new Date(),
    periodStart: start,
    periodEnd: end,
    metrics: { ...graphql, storageGB } as unknown as string,
  });
}

export async function syncQueuesUsage(db: AppDB): Promise<void> {
  const { start, end } = periodRange(30);
  const e = env();

  // Fetch queue list (names) and GraphQL metrics in parallel; list may fail if
  // token lacks queues:read — we fall back to using queueId as the name.
  const [graphqlResult, queuesListResult] = await Promise.allSettled([
    getQueuesUsage(e.CF_API_TOKEN, e.CF_ACCOUNT_ID, start, end),
    getQueues(e.CF_API_TOKEN, e.CF_ACCOUNT_ID),
  ]);

  if (graphqlResult.status === "rejected") throw graphqlResult.reason;
  const usages = graphqlResult.value;
  if (usages.length === 0) return; // no queues or no activity

  const nameMap = new Map<string, string>();
  if (queuesListResult.status === "fulfilled") {
    for (const q of queuesListResult.value) nameMap.set(q.queue_id, q.queue_name);
  }

  const now = new Date();
  const ts = Math.floor(now.getTime() / 1000);

  for (const u of usages) {
    const name = nameMap.get(u.queueId) ?? u.queueId;
    await db.run(
      sql`INSERT INTO queue_snapshots
        (queue_id, queue_name, captured_at, period_start, period_end,
         billable_ops, bytes, messages_written, messages_read, messages_deleted)
        VALUES (${u.queueId}, ${name}, ${ts}, ${start}, ${end},
                ${u.billableOps}, ${u.bytes}, ${u.messagesWritten},
                ${u.messagesRead}, ${u.messagesDeleted})`
    );
  }

  // Aggregate snapshot for the dashboard card
  const totalBillableOps = usages.reduce((s, u) => s + u.billableOps, 0);
  const totalBytes = usages.reduce((s, u) => s + u.bytes, 0);
  await db.insert(usageSnapshots).values({
    resource: "queues",
    capturedAt: now,
    periodStart: start,
    periodEnd: end,
    metrics: {
      billableOps: totalBillableOps,
      bytes: totalBytes,
      queueCount: usages.length,
    } as unknown as string,
  });
}

export async function getLatestQueueSnapshots(db: AppDB) {
  const latest = await db
    .select()
    .from(queueSnapshots)
    .orderBy(desc(queueSnapshots.capturedAt))
    .limit(1);
  if (!latest[0]) return [];
  const latestTime = latest[0].capturedAt;
  return db
    .select()
    .from(queueSnapshots)
    .where(eq(queueSnapshots.capturedAt, latestTime))
    .orderBy(desc(queueSnapshots.billableOps));
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
    { name: "queues", fn: () => syncQueuesUsage(db) },
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

