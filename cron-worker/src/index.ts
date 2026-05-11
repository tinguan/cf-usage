export interface Env {
  SYNC_SECRET: string;
  PAGES_URL?: string; // e.g. https://cfboard.beta128.uk
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    const baseUrl = env.PAGES_URL ?? "https://cfboard.beta128.uk";
    const url = `${baseUrl}/api/sync`;

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Shared secret so /api/sync verifies this is a legitimate cron call
        "X-Cron-Secret": env.SYNC_SECRET,
      },
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Sync failed: ${resp.status} ${text}`);
    }

    console.log("[cron-worker] Sync triggered successfully");
  },
} satisfies ExportedHandler<Env>;
