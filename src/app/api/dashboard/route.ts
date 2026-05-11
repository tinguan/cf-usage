import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getLatestSnapshot, getLatestWorkerSnapshots } from "@/lib/services/usage";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PRICING, TierName, computeEstimatedCost, getUsagePct } from "@/lib/pricing";

export const runtime = "edge";

const RESOURCES = ["workers", "r2", "kv", "d1", "pages"];

export async function GET() {
  const db = getDb();

  const tierRow = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "tier"))
    .limit(1);
  const tier = (tierRow[0]?.value as TierName) ?? "free";

  const cards = await Promise.all(
    RESOURCES.map(async (resource) => {
      const snapshot = await getLatestSnapshot(db, resource);
      const metrics = (snapshot?.metrics ?? {}) as Record<string, number>;
      const pricing = PRICING[resource];
      const limits = tier === "paid" ? pricing?.paid : pricing?.free;

      const estimatedCost = computeEstimatedCost(resource, metrics, tier);

      const usageFields = Object.entries(metrics).map(([key, value]) => ({
        key,
        value,
        pct: getUsagePct(resource, key, value, tier),
        limit: limits ? ((limits as Record<string, number>)[key] ?? null) : null,
      }));

      return {
        resource,
        capturedAt: snapshot?.capturedAt ?? null,
        metrics,
        usageFields,
        estimatedCost,
        tier,
      };
    })
  );

  const workers = await getLatestWorkerSnapshots(db);

  return NextResponse.json({ cards, workers, tier });
}
