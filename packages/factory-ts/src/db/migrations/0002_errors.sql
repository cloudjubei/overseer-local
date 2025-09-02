-- Schema version 2: error snapshots
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS errors (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  step_index INTEGER,
  code TEXT NOT NULL,
  message TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  details_json TEXT,
  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_errors_run ON errors(run_id);

PRAGMA user_version = 2;
