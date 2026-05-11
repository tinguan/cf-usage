export async function sendSlackNotification(
  webhookUrl: string,
  message: {
    resource: string;
    metric: string;
    usageValue: number;
    limitValue: number;
    actualPct: number;
    thresholdPct: number;
    tier: string;
  }
): Promise<void> {
  const emoji = message.actualPct >= 100 ? "🚨" : "⚠️";
  const bar = buildProgressBar(message.actualPct);

  const payload = {
    text: `${emoji} *Cloudflare Spend Alert*`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${emoji} Cloudflare Usage Alert`,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Resource:*\n${message.resource.toUpperCase()}`,
          },
          {
            type: "mrkdwn",
            text: `*Metric:*\n${message.metric}`,
          },
          {
            type: "mrkdwn",
            text: `*Usage:*\n${formatValue(message.usageValue)} / ${formatValue(message.limitValue)} (${message.actualPct.toFixed(1)}%)`,
          },
          {
            type: "mrkdwn",
            text: `*Tier:*\n${message.tier}`,
          },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${bar} ${message.actualPct.toFixed(1)}%\n_Alert threshold: ${message.thresholdPct}%_`,
        },
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Slack webhook failed: ${res.status}`);
  }
}

function buildProgressBar(pct: number): string {
  const filled = Math.min(Math.round(pct / 10), 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

function formatValue(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(2);
}
