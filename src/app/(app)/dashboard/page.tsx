"use client";

import { useEffect, useState, useCallback } from "react";
import { ResourceCard } from "@/components/resource-card";
import { WorkerList } from "@/components/worker-list";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface UsageField {
  key: string;
  value: number;
  pct: number;
  limit: number | null;
}

interface ResourceCardData {
  resource: string;
  capturedAt: string | null;
  usageFields: UsageField[];
  estimatedCost: number;
  tier: string;
}

interface WorkerRow {
  id: number;
  scriptName: string;
  requests: number | null;
  errors: number | null;
  cpuTimeP50: number | null;
  cpuTimeP99: number | null;
}

interface DashboardData {
  cards: ResourceCardData[];
  workers: WorkerRow[];
  tier: string;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as DashboardData;
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000); // refresh every minute
    return () => clearInterval(interval);
  }, [fetchData]);

  async function handleSync() {
    setSyncing(true);
    try {
      await fetch("/api/sync", { method: "POST" });
      await fetchData();
    } finally {
      setSyncing(false);
    }
  }

  const totalEstimatedCost =
    data?.cards.reduce((s, c) => s + c.estimatedCost, 0) ?? 0;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Cloudflare resource usage &amp; estimated costs
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!loading && data && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Est. this month</p>
              <p className="text-lg font-bold font-mono">
                ${totalEstimatedCost.toFixed(2)}
              </p>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync now"}
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 rounded-md p-3">{error}</p>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border bg-card h-40 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.cards.map((card) => (
            <ResourceCard key={card.resource} {...card} />
          ))}
        </div>
      )}

      {data && data.workers.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Workers — Per Script</h2>
          <WorkerList workers={data.workers} />
        </section>
      )}
    </div>
  );
}
