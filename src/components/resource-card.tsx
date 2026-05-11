"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

interface UsageField {
  key: string;
  value: number;
  pct: number;
  limit: number | null;
}

interface ResourceCardProps {
  resource: string;
  capturedAt: string | null;
  usageFields: UsageField[];
  estimatedCost: number;
  tier: string;
}

const RESOURCE_LABELS: Record<string, string> = {
  workers: "Workers",
  r2: "R2 Storage",
  kv: "KV",
  d1: "D1 Database",
  pages: "Pages",
};

const METRIC_LABELS: Record<string, string> = {
  totalRequests: "Requests",
  totalErrors: "Errors",
  totalCpuMs: "CPU Time (ms)",
  storageGB: "Storage (GB)",
  classAOps: "Class A Ops",
  classBOps: "Class B Ops",
  reads: "Reads",
  writes: "Writes",
  deletes: "Deletes",
  rowReads: "Rows Read",
  rowWrites: "Rows Written",
  builds: "Builds",
};

function statusColor(pct: number) {
  if (pct >= 90) return "text-red-500";
  if (pct >= 70) return "text-yellow-500";
  return "text-green-500";
}

function progressColor(pct: number) {
  if (pct >= 90) return "bg-red-500";
  if (pct >= 70) return "bg-yellow-500";
  return "bg-green-500";
}

function formatValue(n: number, key: string): string {
  if (key === "storageGB") return `${n.toFixed(2)} GB`;
  if (key === "totalCpuMs") return `${(n / 1000).toFixed(1)}s`;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

function formatLimit(n: number | null, key: string): string {
  if (n === null) return "unlimited";
  return formatValue(n, key);
}

function formatTimeAgo(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export function ResourceCard({
  resource,
  capturedAt,
  usageFields,
  estimatedCost,
  tier,
}: ResourceCardProps) {
  const hasFields = usageFields.length > 0;
  const maxPct = usageFields.reduce((m, f) => Math.max(m, f.pct), 0);

  return (
    <Card className="flex flex-col gap-0">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">
            {RESOURCE_LABELS[resource] ?? resource}
          </CardTitle>
          <div className="flex items-center gap-2">
            {estimatedCost > 0 && (
              <Badge variant="secondary" className="text-xs font-mono">
                ~${estimatedCost.toFixed(2)} est.
              </Badge>
            )}
            <Badge
              variant="outline"
              className={cn("text-xs capitalize", maxPct >= 90 ? "border-red-500 text-red-500" : maxPct >= 70 ? "border-yellow-500 text-yellow-500" : "")}
            >
              {maxPct >= 90 ? "⚠ High" : maxPct >= 70 ? "~ Moderate" : "OK"}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>Updated {formatTimeAgo(capturedAt)}</span>
          <span className="ml-2 capitalize opacity-60">Tier: {tier}</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {!hasFields && (
          <p className="text-xs text-muted-foreground italic">
            No data yet. Sync will run shortly.
          </p>
        )}
        {usageFields.map((field) => (
          <div key={field.key} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">
                {METRIC_LABELS[field.key] ?? field.key}
              </span>
              <span className={cn("font-mono font-medium", statusColor(field.pct))}>
                {formatValue(field.value, field.key)}
                {field.limit !== null && (
                  <span className="text-muted-foreground font-normal">
                    {" "}/ {formatLimit(field.limit, field.key)}
                  </span>
                )}
              </span>
            </div>
            {field.limit !== null && (
              <div className="relative h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", progressColor(field.pct))}
                  style={{ width: `${Math.min(field.pct, 100)}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
