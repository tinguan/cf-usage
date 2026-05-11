import { AppDB } from "@/lib/db";
import { alertRules, alertEvents, settings } from "@/lib/db/schema";
import { getLatestSnapshot } from "@/lib/services/usage";
import { PRICING, TierName, getUsagePct } from "@/lib/pricing";
import { sendSlackNotification } from "@/lib/slack";
import { eq, and, gte, desc } from "drizzle-orm";

async function getTier(db: AppDB): Promise<TierName> {
  const row = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "tier"))
    .limit(1);
  return (row[0]?.value as TierName) ?? "free";
}

async function getSlackWebhook(db: AppDB): Promise<string | undefined> {
  const row = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "slack_webhook"))
    .limit(1);
  const val = row[0]?.value as string | undefined;
  return val ?? process.env.SLACK_WEBHOOK_URL;
}

async function alreadyFiredToday(db: AppDB, ruleId: number): Promise<boolean> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const recent = await db
    .select()
    .from(alertEvents)
    .where(and(eq(alertEvents.ruleId, ruleId), gte(alertEvents.firedAt, today)))
    .limit(1);

  return recent.length > 0;
}

export async function evaluateAlerts(db: AppDB): Promise<void> {
  const rules = await db
    .select()
    .from(alertRules)
    .where(eq(alertRules.active, true));

  if (rules.length === 0) return;

  const tier = await getTier(db);
  const webhookUrl = await getSlackWebhook(db);

  for (const rule of rules) {
    const snapshot = await getLatestSnapshot(db, rule.resource);
    if (!snapshot) continue;

    const metrics = snapshot.metrics as Record<string, number>;
    const value = metrics[rule.metric] ?? 0;
    const pct = getUsagePct(rule.resource, rule.metric, value, tier);

    if (pct < rule.thresholdPct) continue;
    if (await alreadyFiredToday(db, rule.id)) continue;

    const pricing = PRICING[rule.resource];
    const limits = tier === "paid" ? pricing?.paid : pricing?.free;
    const limit = limits
      ? ((limits as Record<string, number>)[rule.metric] ?? 0)
      : 0;

    await db.insert(alertEvents).values({
      ruleId: rule.id,
      resource: rule.resource,
      metric: rule.metric,
      usageValue: value,
      thresholdPct: rule.thresholdPct,
      actualPct: pct,
      firedAt: new Date(),
      notified: false,
    });

    if (webhookUrl) {
      try {
        await sendSlackNotification(webhookUrl, {
          resource: rule.resource,
          metric: rule.metric,
          usageValue: value,
          limitValue: limit,
          actualPct: pct,
          thresholdPct: rule.thresholdPct,
          tier,
        });

        await db
          .update(alertEvents)
          .set({ notified: true })
          .where(
            and(
              eq(alertEvents.ruleId, rule.id),
              eq(alertEvents.metric, rule.metric)
            )
          );
      } catch (err) {
        console.error("[alerts] Slack notification failed:", err);
      }
    }
  }
}

export async function getRecentAlertEvents(db: AppDB, limit = 50) {
  return db
    .select()
    .from(alertEvents)
    .orderBy(desc(alertEvents.firedAt))
    .limit(limit);
}

