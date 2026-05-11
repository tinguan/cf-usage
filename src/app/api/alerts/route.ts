import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { alertRules } from "@/lib/db/schema";
import { getRecentAlertEvents } from "@/lib/services/alerts";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const runtime = "edge";

const ruleSchema = z.object({
  resource: z.string().min(1),
  metric: z.string().min(1),
  thresholdPct: z.number().min(1).max(999),
});

export async function GET() {
  const db = getDb();
  const rules = await db.select().from(alertRules);
  const events = await getRecentAlertEvents(db, 50);
  return NextResponse.json({ rules, events });
}

export async function POST(request: NextRequest) {
  const db = getDb();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const parsed = ruleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 422 });
  }

  const rule = await db
    .insert(alertRules)
    .values({
      ...parsed.data,
      active: true,
      createdAt: new Date(),
    })
    .returning();

  return NextResponse.json(rule[0], { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  await db.delete(alertRules).where(eq(alertRules.id, id));
  return NextResponse.json({ ok: true });
}
