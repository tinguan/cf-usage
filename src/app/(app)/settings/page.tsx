"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { CheckCircle } from "lucide-react";

const TIER_OPTIONS = [
  {
    value: "free",
    label: "Free",
    description: "Cloudflare free tier limits",
  },
  {
    value: "paid",
    label: "Paid ($5/mo)",
    description: "Workers Paid plan limits",
  },
  {
    value: "custom",
    label: "Custom",
    description: "Set your own limits per resource",
  },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [tier, setTier] = useState("free");
  const [slackWebhook, setSlackWebhook] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data: unknown) => {
        const d = data as Record<string, unknown>;
        setSettings(d);
        setTier((d.tier as string) ?? "free");
        setSlackWebhook((d.slack_webhook as string) ?? "");
        setLoading(false);
      });
  }, []);

  async function handleSave() {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tier,
        slack_webhook: slackWebhook || null,
      }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading) {
    return <div className="animate-pulse h-64 rounded-xl bg-card border" />;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure monitoring tier and notifications
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monitoring Tier</CardTitle>
          <CardDescription>
            Sets the limit baseline used for usage percentage and alerting.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {TIER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTier(opt.value)}
                className={`rounded-lg border p-3 text-left transition-all ${
                  tier === opt.value
                    ? "border-primary bg-accent"
                    : "border-border hover:border-muted-foreground"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold">{opt.label}</span>
                  {tier === opt.value && (
                    <Badge variant="default" className="text-xs px-1 py-0">
                      Active
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {opt.description}
                </p>
              </button>
            ))}
          </div>

          {tier === "custom" && (
            <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              Custom limits can be set per-resource via the API:{" "}
              <code className="text-xs">POST /api/settings</code> with keys
              like <code className="text-xs">custom_limits.workers.requests</code>.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Slack Notifications</CardTitle>
          <CardDescription>
            Enter an Incoming Webhook URL to receive alert messages in Slack.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="slack">Incoming Webhook URL</Label>
            <Input
              id="slack"
              type="url"
              placeholder="https://hooks.slack.com/services/…"
              value={slackWebhook}
              onChange={(e) => setSlackWebhook(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            If empty, falls back to the <code>SLACK_WEBHOOK_URL</code>{" "}
            environment variable.
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave}>Save settings</Button>
        {saved && (
          <span className="flex items-center gap-1 text-sm text-green-600">
            <CheckCircle className="h-4 w-4" />
            Saved
          </span>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current raw settings</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs text-muted-foreground overflow-auto rounded bg-muted p-3">
            {JSON.stringify(settings, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
