"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TrendingUp } from "lucide-react";

interface WorkerRow {
  id: number;
  scriptName: string;
  requests: number | null;
  errors: number | null;
  cpuTimeP50: number | null;
  cpuTimeP99: number | null;
}

interface WorkerListProps {
  workers: WorkerRow[];
}

function errorRate(requests: number, errors: number): number {
  if (!requests) return 0;
  return (errors / requests) * 100;
}

function cpuStatus(p99: number): "ok" | "warn" | "high" {
  if (p99 >= 40) return "high";
  if (p99 >= 20) return "warn";
  return "ok";
}

export function WorkerList({ workers }: WorkerListProps) {
  if (workers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No worker data yet.
      </p>
    );
  }

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Script</TableHead>
            <TableHead className="text-right">Requests</TableHead>
            <TableHead className="text-right">Errors</TableHead>
            <TableHead className="text-right">CPU p50</TableHead>
            <TableHead className="text-right">CPU p99</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {workers.map((w) => {
            const req = w.requests ?? 0;
            const err = w.errors ?? 0;
            const p50 = w.cpuTimeP50 ?? 0;
            const p99 = w.cpuTimeP99 ?? 0;
            const errPct = errorRate(req, err);
            const cpuSt = cpuStatus(p99);

            return (
              <TableRow key={w.id}>
                <TableCell className="font-mono text-xs">
                  {w.scriptName}
                </TableCell>
                <TableCell className="text-right text-xs font-mono">
                  {req.toLocaleString()}
                </TableCell>
                <TableCell className="text-right text-xs">
                  {err > 0 ? (
                    <span className="text-red-500 font-mono">
                      {err.toLocaleString()}
                      <span className="text-muted-foreground">
                        {" "}({errPct.toFixed(1)}%)
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {p50.toFixed(1)}ms
                </TableCell>
                <TableCell className="text-right text-xs">
                  <div className="flex items-center justify-end gap-1.5">
                    {cpuSt !== "ok" && (
                      <TrendingUp
                        className={cn(
                          "h-3 w-3",
                          cpuSt === "high" ? "text-red-500" : "text-yellow-500"
                        )}
                      />
                    )}
                    <Badge
                      variant={cpuSt === "high" ? "destructive" : cpuSt === "warn" ? "secondary" : "outline"}
                      className="font-mono text-xs px-1 py-0"
                    >
                      {p99.toFixed(1)}ms
                    </Badge>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
