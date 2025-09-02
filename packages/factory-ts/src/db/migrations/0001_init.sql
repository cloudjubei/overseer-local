-- Schema version 1
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  task_id TEXT,
  feature_id TEXT,
  agent_kind TEXT NOT NULL,
  llm_model TEXT,
  config_json TEXT,
  git_branch TEXT,
  status TEXT NOT NULL, -- running | succeeded | failed | cancelled
  started_at INTEGER NOT NULL,
  ended_at INTEGER
);

CREATE TABLE IF NOT EXISTS steps (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  idx INTEGER NOT NULL,
  kind TEXT NOT NULL,
  label TEXT,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  meta_json TEXT,
  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE,
  UNIQUE (run_id, idx)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  model TEXT,
  step_index INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS usage (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  step_index INTEGER,
  model TEXT,
  prompt_tokens INTEGER NOT NULL,
  completion_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  cost_usd REAL NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS file_proposals (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  step_index INTEGER,
  action TEXT NOT NULL, -- write | delete | rename | move
  file_path TEXT NOT NULL,
  file_path_to TEXT,
  diff TEXT,
  status TEXT NOT NULL, -- proposed | accepted | rejected
  created_at INTEGER NOT NULL,
  decided_at INTEGER,
  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS git_commits (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  step_index INTEGER,
  commit_hash TEXT NOT NULL,
  branch TEXT,
  title TEXT,
  body TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
);

-- index hints
CREATE INDEX IF NOT EXISTS idx_runs_project ON runs(project_id);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
CREATE INDEX IF NOT EXISTS idx_steps_run ON steps(run_id);
CREATE INDEX IF NOT EXISTS idx_messages_run ON messages(run_id);
CREATE INDEX IF NOT EXISTS idx_usage_run ON usage(run_id);
CREATE INDEX IF NOT EXISTS idx_file_proposals_run ON file_proposals(run_id);
CREATE INDEX IF NOT EXISTS idx_git_commits_run ON git_commits(run_id);

PRAGMA user_version = 1;
