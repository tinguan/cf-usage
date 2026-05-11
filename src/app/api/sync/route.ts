import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { syncAll } from "@/lib/services/usage";
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
    // Valid cron call — proceed
  }
  // Session path: middleware already verified the session cookie, so fall through

  const db = getDb();
  const result = await syncAll(db);
  await evaluateAlerts(db);
  return NextResponse.json(result);
}
