import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { billingHistory } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export const runtime = "edge";

export async function GET() {
  const db = getDb();
  const rows = await db
    .select()
    .from(billingHistory)
    .orderBy(desc(billingHistory.billedOn))
    .limit(100);

  // Group by month for chart data
  const byMonth: Record<string, number> = {};
  for (const row of rows) {
    const month = row.billedOn.slice(0, 7); // "YYYY-MM"
    byMonth[month] = (byMonth[month] ?? 0) + row.amount;
  }

  const monthlyChart = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({ month, total }));

  const totalSpend = rows.reduce((s, r) => s + r.amount, 0);

  return NextResponse.json({ entries: rows, monthlyChart, totalSpend });
}
