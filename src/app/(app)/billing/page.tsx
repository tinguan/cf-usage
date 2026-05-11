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
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface BillingEntry {
  id: number;
  invoiceId: string;
  type: string;
  name: string;
  billedOn: string;
  amount: number;
  currency: string;
}

interface MonthlyPoint {
  month: string;
  total: number;
}

interface BillingData {
  entries: BillingEntry[];
  monthlyChart: MonthlyPoint[];
  totalSpend: number;
}

export default function BillingPage() {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/billing")
      .then((r) => r.json())
      .then((d: unknown) => {
        setData(d as BillingData);
        setLoading(false);
      });
  }, []);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  if (loading) {
    return <div className="h-64 animate-pulse bg-card rounded-xl border" />;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Past invoices and spend breakdown
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total recorded spend</CardDescription>
            <CardTitle className="text-2xl font-mono">
              ${data?.totalSpend.toFixed(2) ?? "0.00"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Invoice records</CardDescription>
            <CardTitle className="text-2xl font-mono">
              {data?.entries.length ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Months tracked</CardDescription>
            <CardTitle className="text-2xl font-mono">
              {data?.monthlyChart.length ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Monthly chart */}
      {data && data.monthlyChart.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Monthly Spend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.monthlyChart} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                />
                <YAxis
                  tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                />
                <Tooltip
                  formatter={(value) => {
                    const n = typeof value === "number" ? value : Number(value ?? 0);
                    return [`$${n.toFixed(2)}`, "Spend"];
                  }}
                  contentStyle={{
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="total" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Invoice table */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice History</CardTitle>
          <CardDescription>
            Click a row to expand details. Synced from Cloudflare billing API.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!data || data.entries.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No billing records yet. Run a sync to fetch from Cloudflare.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.entries.map((entry) => (
                  <>
                    <TableRow
                      key={entry.id}
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() =>
                        setExpanded(
                          expanded === entry.invoiceId ? null : entry.invoiceId
                        )
                      }
                    >
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatDate(entry.billedOn)}
                      </TableCell>
                      <TableCell className="text-sm max-w-xs truncate">
                        {entry.name}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={entry.type === "credit" ? "secondary" : "outline"}
                          className="text-xs capitalize"
                        >
                          {entry.type}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono text-sm font-medium ${
                          entry.type === "credit"
                            ? "text-green-600"
                            : ""
                        }`}
                      >
                        {entry.type === "credit" ? "−" : ""}$
                        {Math.abs(entry.amount).toFixed(2)}
                      </TableCell>
                    </TableRow>
                    {expanded === entry.invoiceId && (
                      <TableRow key={`${entry.id}-expanded`}>
                        <TableCell
                          colSpan={4}
                          className="bg-muted/40 text-xs font-mono p-3"
                        >
                          <div className="space-y-1">
                            <p>
                              <span className="text-muted-foreground">ID:</span>{" "}
                              {entry.invoiceId}
                            </p>
                            <p>
                              <span className="text-muted-foreground">
                                Currency:
                              </span>{" "}
                              {entry.currency}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
