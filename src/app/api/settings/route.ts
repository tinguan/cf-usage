import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "edge";

export async function GET() {
  const db = getDb();
  const rows = await db.select().from(settings);
  const result: Record<string, unknown> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const db = getDb();
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const now = new Date();

  for (const [key, value] of Object.entries(body)) {
    await db
      .insert(settings)
      .values({ key, value: value as string, updatedAt: now })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: value as string, updatedAt: now },
      });
  }

  return NextResponse.json({ ok: true });
}
