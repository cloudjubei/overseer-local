import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export type DBOptions = {
  dbPath?: string; // custom absolute path to sqlite file
  migrationsDir?: string; // override migrations directory for testing
};

export type SQLiteHandle = {
  db: Database.Database;
  close: () => void;
};

const DEFAULT_DB_FILE = 'overseer-factory.sqlite3';

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

export function defaultDataDir(): string {
  // Try to use Overseer data dir via env, fallback to OS home
  const fromEnv = process.env.OVERSEER_DATA_DIR;
  if (fromEnv && fromEnv.trim()) return fromEnv;
  const home = process.env.HOME || process.env.USERPROFILE || process.cwd();
  const dir = path.join(home, '.overseer');
  ensureDir(dir);
  return dir;
}

export function resolveDbPath(custom?: string): string {
  if (custom) {
    const dir = path.dirname(custom);
    ensureDir(dir);
    return custom;
  }
  const dir = defaultDataDir();
  ensureDir(dir);
  return path.join(dir, DEFAULT_DB_FILE);
}

function getMigrationsDir(override?: string): string {
  if (override) return override;
  // Resolve relative to this file compiled location -> src/db/ -> migrations
  return path.resolve(__dirname, 'migrations');
}

function getCurrentSchemaVersion(db: Database.Database): number {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number } | undefined;
  return row ? (row as any).user_version ?? 0 : 0;
}

function setCurrentSchemaVersion(db: Database.Database, v: number) {
  db.pragma(`user_version = ${v}`);
}

function readMigrationFiles(migrationsDir: string) {
  if (!fs.existsSync(migrationsDir)) return [] as { version: number; name: string; sql: string }[];
  const files = fs.readdirSync(migrationsDir).filter(f => /^(\d+)_.*\.sql$/.test(f));
  const items = files.map(f => {
    const [num] = f.split('_');
    const version = Number(num);
    const sql = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
    return { version, name: f, sql };
  });
  items.sort((a, b) => a.version - b.version);
  return items;
}

function applyMigrations(db: Database.Database, migrationsDir: string) {
  const migrations = readMigrationFiles(migrationsDir);
  const current = getCurrentSchemaVersion(db);
  for (const mig of migrations) {
    if (mig.version > current) {
      db.transaction(() => {
        db.exec(mig.sql);
        setCurrentSchemaVersion(db, mig.version);
      })();
    }
  }
}

export function openDatabase(opts: DBOptions = {}): SQLiteHandle {
  const dbPath = resolveDbPath(opts.dbPath);
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  applyMigrations(db, getMigrationsDir(opts.migrationsDir));
  return {
    db,
    close: () => db.close(),
  };
}

export type RunStatus = 'running' | 'succeeded' | 'failed' | 'cancelled';

export type CreateRunInput = {
  projectId: string;
  taskId?: string | null;
  featureId?: string | null;
  agentKind: string; // developer, planner, tester, etc
  llmModel?: string | null;
  configJson?: any; // JSON serializable
  gitBranch?: string | null;
  startedAt?: number; // ms epoch
};

export type RunRecord = {
  id: string;
  projectId: string;
  taskId: string | null;
  featureId: string | null;
  agentKind: string;
  llmModel: string | null;
  configJson: any | null;
  gitBranch: string | null;
  status: RunStatus;
  startedAt: number;
  endedAt: number | null;
};

export type StepRecord = {
  id: string;
  runId: string;
  index: number;
  kind: string; // plan, tool, code, file, commit, etc
  label: string | null;
  startedAt: number;
  endedAt: number | null;
  meta: any | null; // json
};

export type MessageRecord = {
  id: string;
  runId: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string; // raw text or JSON stringified if needed
  model: string | null;
  stepIndex: number | null;
  createdAt: number;
};

export type UsageSnapshot = {
  id: string;
  runId: string;
  stepIndex: number | null;
  model: string | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUSD: number; // computed at record time
  createdAt: number;
};

export type FileProposal = {
  id: string;
  runId: string;
  stepIndex: number | null;
  action: 'write' | 'delete' | 'rename' | 'move';
  filePath: string; // relative
  filePathTo?: string | null; // for rename/move
  diff?: string | null; // unified diff or content preview
  status: 'proposed' | 'accepted' | 'rejected';
  createdAt: number;
  decidedAt: number | null;
};

export type GitCommitMeta = {
  id: string;
  runId: string;
  stepIndex: number | null;
  commitHash: string;
  branch: string | null;
  title: string | null;
  body: string | null;
  createdAt: number;
};

export type ErrorSnapshot = {
  id: string;
  runId: string;
  stepIndex: number | null;
  code: string;
  message: string;
  occurredAt: number;
  details?: any | null; // redacted JSON payload
}

// CRUD API
export class HistoryStore {
  private db: Database.Database;

  constructor(handle: SQLiteHandle | Database.Database) {
    this.db = 'db' in handle ? handle.db : handle;
  }

  // Runs
  createRun(input: CreateRunInput): RunRecord {
    const now = input.startedAt ?? Date.now();
    const id = randomId();
    const stmt = this.db.prepare(`
      INSERT INTO runs (id, project_id, task_id, feature_id, agent_kind, llm_model, config_json, git_branch, status, started_at, ended_at)
      VALUES (@id, @projectId, @taskId, @featureId, @agentKind, @llmModel, @configJson, @gitBranch, 'running', @startedAt, NULL)
    `);
    stmt.run({
      id,
      projectId: input.projectId,
      taskId: input.taskId ?? null,
      featureId: input.featureId ?? null,
      agentKind: input.agentKind,
      llmModel: input.llmModel ?? null,
      configJson: input.configJson ? JSON.stringify(input.configJson) : null,
      gitBranch: input.gitBranch ?? null,
      startedAt: now,
    });
    return this.getRunById(id)!;
  }

  finalizeRun(runId: string, status: RunStatus, endedAt?: number): void {
    const stmt = this.db.prepare(`
      UPDATE runs SET status = @status, ended_at = @endedAt WHERE id = @id
    `);
    stmt.run({ id: runId, status, endedAt: endedAt ?? Date.now() });
  }

  getRunById(id: string): RunRecord | null {
    const row = this.db.prepare(`
      SELECT id, project_id as projectId, task_id as taskId, feature_id as featureId, agent_kind as agentKind, llm_model as llmModel,
             config_json as configJson, git_branch as gitBranch, status, started_at as startedAt, ended_at as endedAt
      FROM runs WHERE id = ?
    `).get(id) as any;
    if (!row) return null;
    if (row.configJson) {
      try { row.configJson = JSON.parse(row.configJson); } catch {}
    }
    return row as RunRecord;
  }

  listRuns(filters?: { projectId?: string; taskId?: string; status?: RunStatus; limit?: number; offset?: number }): RunRecord[] {
    const where: string[] = [];
    const params: any = {};
    if (filters?.projectId) { where.push('project_id = @projectId'); params.projectId = filters.projectId; }
    if (filters?.taskId) { where.push('task_id = @taskId'); params.taskId = filters.taskId; }
    if (filters?.status) { where.push('status = @status'); params.status = filters.status; }
    const sql = `
      SELECT id, project_id as projectId, task_id as taskId, feature_id as featureId, agent_kind as agentKind, llm_model as llmModel,
             config_json as configJson, git_branch as gitBranch, status, started_at as startedAt, ended_at as endedAt
      FROM runs
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY started_at DESC
      LIMIT @limit OFFSET @offset
    `;
    params.limit = filters?.limit ?? 50;
    params.offset = filters?.offset ?? 0;
    const rows = this.db.prepare(sql).all(params) as any[];
    return rows.map(r => {
      if (r.configJson) {
        try { r.configJson = JSON.parse(r.configJson); } catch {}
      }
      return r as RunRecord;
    });
  }

  // Steps
  appendStep(runId: string, input: { kind: string; label?: string | null; startedAt?: number; meta?: any }): StepRecord {
    const index = (this.db.prepare('SELECT COALESCE(MAX(idx), -1) + 1 AS next FROM steps WHERE run_id = ?').get(runId) as any)?.next ?? 0;
    const id = randomId();
    const stmt = this.db.prepare(`
      INSERT INTO steps (id, run_id, idx, kind, label, started_at, ended_at, meta_json)
      VALUES (@id, @runId, @index, @kind, @label, @startedAt, NULL, @meta)
    `);
    stmt.run({
      id,
      runId,
      index,
      kind: input.kind,
      label: input.label ?? null,
      startedAt: input.startedAt ?? Date.now(),
      meta: input.meta ? JSON.stringify(input.meta) : null,
    });
    return this.getStep(runId, index)!;
  }

  endStep(runId: string, index: number, endedAt?: number) {
    this.db.prepare('UPDATE steps SET ended_at = ? WHERE run_id = ? AND idx = ?').run(endedAt ?? Date.now(), runId, index);
  }

  getStep(runId: string, index: number): StepRecord | null {
    const row = this.db.prepare(`
      SELECT id, run_id as runId, idx as index, kind, label, started_at as startedAt, ended_at as endedAt, meta_json as meta
      FROM steps WHERE run_id = ? AND idx = ?
    `).get(runId, index) as any;
    if (!row) return null;
    if (row.meta) {
      try { row.meta = JSON.parse(row.meta); } catch {}
    }
    return row as StepRecord;
  }

  // Messages
  appendMessage(runId: string, msg: { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; model?: string | null; stepIndex?: number | null; createdAt?: number }): MessageRecord {
    const id = randomId();
    const createdAt = msg.createdAt ?? Date.now();
    this.db.prepare(`
      INSERT INTO messages (id, run_id, role, content, model, step_index, created_at)
      VALUES (@id, @runId, @role, @content, @model, @stepIndex, @createdAt)
    `).run({ id, runId, role: msg.role, content: msg.content, model: msg.model ?? null, stepIndex: msg.stepIndex ?? null, createdAt });
    return this.getMessageById(id)!;
  }

  getMessageById(id: string): MessageRecord | null {
    const row = this.db.prepare(`
      SELECT id, run_id as runId, role, content, model, step_index as stepIndex, created_at as createdAt
      FROM messages WHERE id = ?
    `).get(id) as any;
    return row ?? null;
  }

  // Usage
  recordUsage(runId: string, u: { stepIndex?: number | null; model?: string | null; promptTokens: number; completionTokens: number; costUSD: number; createdAt?: number }): UsageSnapshot {
    const id = randomId();
    const createdAt = u.createdAt ?? Date.now();
    const totalTokens = (u.promptTokens ?? 0) + (u.completionTokens ?? 0);
    this.db.prepare(`
      INSERT INTO usage (id, run_id, step_index, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, created_at)
      VALUES (@id, @runId, @stepIndex, @model, @pt, @ct, @tt, @cost, @createdAt)
    `).run({ id, runId, stepIndex: u.stepIndex ?? null, model: u.model ?? null, pt: u.promptTokens, ct: u.completionTokens, tt: totalTokens, cost: u.costUSD, createdAt });
    return this.getUsageById(id)!;
  }

  getUsageById(id: string): UsageSnapshot | null {
    const row = this.db.prepare(`
      SELECT id, run_id as runId, step_index as stepIndex, model, prompt_tokens as promptTokens, completion_tokens as completionTokens, total_tokens as totalTokens, cost_usd as costUSD, created_at as createdAt
      FROM usage WHERE id = ?
    `).get(id) as any;
    return row ?? null;
  }

  // File proposals
  saveFileProposal(runId: string, p: { stepIndex?: number | null; action: 'write' | 'delete' | 'rename' | 'move'; filePath: string; filePathTo?: string | null; diff?: string | null; }): FileProposal {
    const id = randomId();
    const createdAt = Date.now();
    this.db.prepare(`
      INSERT INTO file_proposals (id, run_id, step_index, action, file_path, file_path_to, diff, status, created_at, decided_at)
      VALUES (@id, @runId, @stepIndex, @action, @filePath, @filePathTo, @diff, 'proposed', @createdAt, NULL)
    `).run({ id, runId, stepIndex: p.stepIndex ?? null, action: p.action, filePath: p.filePath, filePathTo: p.filePathTo ?? null, diff: p.diff ?? null, createdAt });
    return this.getFileProposalById(id)!;
  }

  setFileProposalStatus(id: string, status: 'accepted' | 'rejected'): void {
    this.db.prepare(`UPDATE file_proposals SET status = ?, decided_at = ? WHERE id = ?`).run(status, Date.now(), id);
  }

  getFileProposalById(id: string): FileProposal | null {
    const row = this.db.prepare(`
      SELECT id, run_id as runId, step_index as stepIndex, action, file_path as filePath, file_path_to as filePathTo, diff, status, created_at as createdAt, decided_at as decidedAt
      FROM file_proposals WHERE id = ?
    `).get(id) as any;
    return row ?? null;
  }

  // Git commits
  saveGitCommit(runId: string, c: { stepIndex?: number | null; commitHash: string; branch?: string | null; title?: string | null; body?: string | null; createdAt?: number }): GitCommitMeta {
    const id = randomId();
    const createdAt = c.createdAt ?? Date.now();
    this.db.prepare(`
      INSERT INTO git_commits (id, run_id, step_index, commit_hash, branch, title, body, created_at)
      VALUES (@id, @runId, @stepIndex, @commitHash, @branch, @title, @body, @createdAt)
    `).run({ id, runId, stepIndex: c.stepIndex ?? null, commitHash: c.commitHash, branch: c.branch ?? null, title: c.title ?? null, body: c.body ?? null, createdAt });
    return this.getGitCommitById(id)!;
  }

  getGitCommitById(id: string): GitCommitMeta | null {
    const row = this.db.prepare(`
      SELECT id, run_id as runId, step_index as stepIndex, commit_hash as commitHash, branch, title, body, created_at as createdAt
      FROM git_commits WHERE id = ?
    `).get(id) as any;
    return row ?? null;
  }

  // Errors
  saveError(runId: string, e: { stepIndex?: number | null; code: string; message: string; occurredAt?: number; details?: any | null }): ErrorSnapshot {
    const id = randomId();
    const occurredAt = e.occurredAt ?? Date.now();
    this.db.prepare(`
      INSERT INTO errors (id, run_id, step_index, code, message, occurred_at, details_json)
      VALUES (@id, @runId, @stepIndex, @code, @message, @occurredAt, @details)
    `).run({ id, runId, stepIndex: e.stepIndex ?? null, code: e.code, message: e.message, occurredAt, details: e.details ? JSON.stringify(e.details) : null });
    return this.getErrorById(id)!;
  }

  getErrorById(id: string): ErrorSnapshot | null {
    const row = this.db.prepare(`
      SELECT id, run_id as runId, step_index as stepIndex, code, message, occurred_at as occurredAt, details_json as details
      FROM errors WHERE id = ?
    `).get(id) as any;
    if (!row) return null
    if (row.details) {
      try { row.details = JSON.parse(row.details) } catch {}
    }
    return row as ErrorSnapshot
  }

  listErrors(runId: string): ErrorSnapshot[] {
    const rows = this.db.prepare(`
      SELECT id, run_id as runId, step_index as stepIndex, code, message, occurred_at as occurredAt, details_json as details
      FROM errors WHERE run_id = ? ORDER BY occurred_at ASC
    `).all(runId) as any[]
    return rows.map(r => {
      if (r.details) {
        try { r.details = JSON.parse(r.details) } catch {}
      }
      return r as ErrorSnapshot
    })
  }

  // Aggregates
  getRunArtifacts(runId: string): {
    steps: StepRecord[];
    messages: MessageRecord[];
    usage: UsageSnapshot[];
    fileProposals: FileProposal[];
    commits: GitCommitMeta[];
    errors: ErrorSnapshot[];
  } {
    const steps = this.db.prepare(`
      SELECT id, run_id as runId, idx as index, kind, label, started_at as startedAt, ended_at as endedAt, meta_json as meta
      FROM steps WHERE run_id = ? ORDER BY idx ASC
    `).all(runId) as any[];
    steps.forEach(s => { if (s.meta) { try { s.meta = JSON.parse(s.meta); } catch {} } });

    const messages = this.db.prepare(`
      SELECT id, run_id as runId, role, content, model, step_index as stepIndex, created_at as createdAt
      FROM messages WHERE run_id = ? ORDER BY created_at ASC
    `).all(runId) as MessageRecord[];

    const usage = this.db.prepare(`
      SELECT id, run_id as runId, step_index as stepIndex, model, prompt_tokens as promptTokens, completion_tokens as completionTokens, total_tokens as totalTokens, cost_usd as costUSD, created_at as createdAt
      FROM usage WHERE run_id = ? ORDER BY created_at ASC
    `).all(runId) as UsageSnapshot[];

    const fileProposals = this.db.prepare(`
      SELECT id, run_id as runId, step_index as stepIndex, action, file_path as filePath, file_path_to as filePathTo, diff, status, created_at as createdAt, decided_at as decidedAt
      FROM file_proposals WHERE run_id = ? ORDER BY created_at ASC
    `).all(runId) as FileProposal[];

    const commits = this.db.prepare(`
      SELECT id, run_id as RunId, step_index as stepIndex, commit_hash as commitHash, branch, title, body, created_at as createdAt
      FROM git_commits WHERE run_id = ? ORDER BY created_at ASC
    `).all(runId) as GitCommitMeta[];

    const errors = this.listErrors(runId)

    return { steps, messages, usage, fileProposals, commits, errors };
  }
}

function randomId(): string {
  // Simple, safe enough for local DB keys
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}
