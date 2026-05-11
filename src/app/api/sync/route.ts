import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { syncAll, getLastSyncTime, getSyncIntervalHours } from "@/lib/services/usage";
import { evaluateAlerts } from "@/lib/services/alerts";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get("x-cron-secret");
  const sessionSecret = process.env.SESSION_SECRET;

  // Cron path: secret must be present and match
  if (cronSecret !== null) {
    if (!sessionSecret || cronSecret !== sessionSecret) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  // Session path: middleware already verified the session cookie, so fall through

  const db = getDb();

  // When called from cron, skip if within the configured interval.
  // Session-triggered syncs always run (manual / force).
  if (cronSecret !== null) {
    const lastSync = await getLastSyncTime(db);
    if (lastSync) {
      const intervalHours = await getSyncIntervalHours(db);
      const elapsedHours = (Date.now() - lastSync.getTime()) / 3_600_000;
      if (elapsedHours < intervalHours) {
        return NextResponse.json({
          skipped: true,
          nextSyncIn: `${(intervalHours - elapsedHours).toFixed(1)}h`,
        });
      }
    }
  }

  const result = await syncAll(db);
  await evaluateAlerts(db);
  return NextResponse.json(result);
}
