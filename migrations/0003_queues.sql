-- Add per-queue snapshots table for Queues monitoring

CREATE TABLE IF NOT EXISTS queue_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  queue_id TEXT NOT NULL,
  queue_name TEXT NOT NULL,
  captured_at INTEGER NOT NULL,   -- unix epoch
  period_start TEXT NOT NULL,      -- ISO date
  period_end TEXT NOT NULL,
  billable_ops INTEGER DEFAULT 0,  -- writes + reads + deletes
  bytes INTEGER DEFAULT 0,
  messages_written INTEGER DEFAULT 0,
  messages_read INTEGER DEFAULT 0,
  messages_deleted INTEGER DEFAULT 0
);
