-- D1 initial schema for cf_spend

CREATE TABLE IF NOT EXISTS usage_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resource TEXT NOT NULL,
  captured_at INTEGER NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  metrics TEXT NOT NULL -- JSON
);

CREATE TABLE IF NOT EXISTS worker_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  script_name TEXT NOT NULL,
  captured_at INTEGER NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  requests INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  subrequests INTEGER DEFAULT 0,
  cpu_time_p50 REAL DEFAULT 0,
  cpu_time_p99 REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS alert_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resource TEXT NOT NULL,
  metric TEXT NOT NULL,
  threshold_pct REAL NOT NULL,
  active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS alert_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id INTEGER NOT NULL,
  resource TEXT NOT NULL,
  metric TEXT NOT NULL,
  usage_value REAL NOT NULL,
  threshold_pct REAL NOT NULL,
  actual_pct REAL NOT NULL,
  fired_at INTEGER NOT NULL,
  notified INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS billing_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  name TEXT,
  billed_on TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  line_items TEXT, -- JSON
  fetched_at INTEGER NOT NULL DEFAULT (unixepoch())
);
