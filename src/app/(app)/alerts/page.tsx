"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, Bell } from "lucide-react";

interface AlertRule {
  id: number;
  resource: string;
  metric: string;
  thresholdPct: number;
  active: boolean;
  createdAt: string;
}

interface AlertEvent {
  id: number;
  resource: string;
  metric: string;
  usageValue: number;
  thresholdPct: number;
  actualPct: number;
  firedAt: string;
  notified: boolean;
}

const RESOURCE_METRICS: Record<string, string[]> = {
  workers: ["totalRequests", "totalCpuMs"],
  r2: ["storageGB", "classAOps", "classBOps"],
  kv: ["reads", "writes", "deletes"],
  d1: ["rowReads", "rowWrites"],
  pages: ["builds"],
};

export default function AlertsPage() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const [newResource, setNewResource] = useState("workers");
  const [newMetric, setNewMetric] = useState("totalRequests");
  const [newThreshold, setNewThreshold] = useState("80");

  async function fetchData() {
    const res = await fetch("/api/alerts");
    const data = (await res.json()) as { rules: AlertRule[]; events: AlertEvent[] };
    setRules(data.rules);
    setEvents(data.events);
    setLoading(false);
  }

  useEffect(() => {
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate() {
    await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resource: newResource,
        metric: newMetric,
        thresholdPct: Number(newThreshold),
      }),
    });
    await fetchData();
  }

  async function handleDelete(id: number) {
    await fetch(`/api/alerts?id=${id}`, { method: "DELETE" });
    setRules((r) => r.filter((rule) => rule.id !== id));
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString();
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Alerts</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Set usage thresholds and track when they fire
        </p>
      </div>

      {/* Create rule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            New Alert Rule
          </CardTitle>
          <CardDescription>
            Alert fires (Slack + log) when usage % exceeds the threshold.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1.5">
              <Label>Resource</Label>
              <Select
                value={newResource}
                onValueChange={(v) => {
                  if (!v) return;
                  setNewResource(v);
                  setNewMetric(RESOURCE_METRICS[v]?.[0] ?? "");
                }}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(RESOURCE_METRICS).map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Metric</Label>
              <Select value={newMetric} onValueChange={(v) => { if (v) setNewMetric(v); }}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(RESOURCE_METRICS[newResource] ?? []).map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Threshold %</Label>
              <Input
                type="number"
                min={1}
                max={999}
                className="w-24"
                value={newThreshold}
                onChange={(e) => setNewThreshold(e.target.value)}
              />
            </div>

            <Button onClick={handleCreate}>Add Rule</Button>
          </div>
        </CardContent>
      </Card>

      {/* Existing rules */}
      <Card>
        <CardHeader>
          <CardTitle>Active Rules</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-20 animate-pulse bg-muted rounded" />
          ) : rules.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No alert rules yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Resource</TableHead>
                  <TableHead>Metric</TableHead>
                  <TableHead>Threshold</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <Badge variant="outline">{rule.resource}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {rule.metric}
                    </TableCell>
                    <TableCell className="font-mono">
                      {rule.thresholdPct}%
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(String(rule.createdAt))}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-red-500"
                        onClick={() => handleDelete(rule.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Event history */}
      <Card>
        <CardHeader>
          <CardTitle>Alert History</CardTitle>
          <CardDescription>Last 50 fired alert events</CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No alerts have fired yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Metric</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Threshold</TableHead>
                  <TableHead>Notified</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((ev) => (
                  <TableRow key={ev.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(String(ev.firedAt))}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{ev.resource}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {ev.metric}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <span
                        className={
                          ev.actualPct >= 100
                            ? "text-red-500"
                            : "text-yellow-500"
                        }
                      >
                        {ev.actualPct.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {ev.thresholdPct}%
                    </TableCell>
                    <TableCell>
                      {ev.notified ? (
                        <Badge variant="secondary" className="text-xs">
                          Sent
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
