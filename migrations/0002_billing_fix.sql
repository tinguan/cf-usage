-- Fix billing_history: add fetched_at, make name nullable
ALTER TABLE billing_history ADD COLUMN fetched_at INTEGER NOT NULL DEFAULT (unixepoch());

-- SQLite doesn't support ALTER COLUMN to drop NOT NULL, so we recreate
-- Only needed if billing_history has rows already (safe to run either way)
CREATE TABLE IF NOT EXISTS billing_history_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  name TEXT,
  billed_on TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  line_items TEXT,
  fetched_at INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT OR IGNORE INTO billing_history_new SELECT id, invoice_id, type, name, billed_on, amount, currency, line_items, fetched_at FROM billing_history;
DROP TABLE billing_history;
ALTER TABLE billing_history_new RENAME TO billing_history;
