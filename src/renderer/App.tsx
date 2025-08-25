import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

// ----- Types -----
type Status = '+' | '~' | '-' | '?' | '=';

type Feature = {
  id: string;
  status: Status;
  title: string;
  description: string;
  plan: string;
  context: string[];
  acceptance: string[];
  dependencies?: string[];
  rejection?: string;
};

type Task = {
  id: number;
  status: Status;
  title: string;
  description: string;
  features: Feature[];
  rejection?: string;
};

type TasksIndexSnapshot = {
  tasksById: Record<string, Task>;
};

declare global {
  interface Window {
    tasksIndex: {
      getSnapshot: () => Promise<TasksIndexSnapshot>;
      onUpdate: (cb: (idx: TasksIndexSnapshot) => void) => () => void;
      updateTask: (taskId: number, data: { title?: string; description?: string }) => Promise<{ ok: boolean; error?: string }>;
      updateFeature: (taskId: number, featureId: string, data: Partial<Feature>) => Promise<{ ok: boolean; error?: string }>;
      addTask: (payload: { id?: number; status?: Status; title: string; description: string }) => Promise<{ ok: boolean; id?: number; error?: string }>;
      openTaskCreate: () => Promise<{ ok: boolean; error?: string }>;
      openFeatureCreate: (taskId: number) => Promise<{ ok: boolean; error?: string }>;
    };
  }
}

// ----- Constants / helpers -----
const STATUS_LABELS: Record<Status, string> = {
  '+': 'Done',
  '~': 'In Progress',
  '-': 'Pending',
  '?': 'Blocked',
  '=': 'Deferred',
};
const STATUS_OPTIONS: Status[] = ['+', '~', '-', '?', '='];

function statusCss(status: Status): string {
  switch (status) {
    case '+': return 'done';
    case '~': return 'inprogress';
    case '-': return 'pending';
    case '?': return 'blocked';
    case '=': return 'deferred';
    default: return 'unknown';
  }
}

function useTasksIndex() {
  const [snapshot, setSnapshot] = useState<TasksIndexSnapshot | null>(null);
  useEffect(() => {
    let unsub: null | (() => void) = null;
    (async () => {
      try {
        const s = await window.tasksIndex.getSnapshot();
        setSnapshot(s);
      } catch (_) {}
      try {
        unsub = window.tasksIndex.onUpdate((idx) => setSnapshot(idx));
      } catch (_) {}
    })();
    return () => { try { unsub && unsub(); } catch (_) {} };
  }, []);
  return snapshot;
}

function parseRoute(hash: string) {
  const m = /^#task\/(\d+)$/.exec(hash || '');
  if (m) return { name: 'details' as const, id: parseInt(m[1], 10) };
  return { name: 'list' as const };
}

function useRoute() {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onHash = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return route;
}

// ----- UI primitives -----
function StatusBadge({ status }: { status: Status }) {
  const label = STATUS_LABELS[status] || status;
  return <span className={`status-badge status-${statusCss(status)}`} role="img" aria-label={label}>{label}</span>;
}

// ----- Tasks List View (React) -----
function toTasksArray(index: TasksIndexSnapshot | null): Task[] {
  if (!index || !index.tasksById) return [] as Task[];
  const arr: Task[] = Object.values(index.tasksById);
  arr.sort((a, b) => (a.id || 0) - (b.id || 0));
  return arr;
}

function countFeatures(task: Task) {
  const feats = Array.isArray(task.features) ? task.features : [];
  const total = feats.length;
  const done = feats.filter(f => f.status === '+').length;
  return { done, total };
}

function matchesQuery(task: Task, q: string) {
  if (!q) return true;
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const idStr = String(task.id || '');
  return (
    idStr.includes(s) ||
    (task.title && task.title.toLowerCase().includes(s)) ||
    (task.description && task.description.toLowerCase().includes(s))
  );
}

function filterTasks(tasks: Task[], query: string, status: 'any' | Status) {
  return tasks.filter(t => (status === 'any' ? true : t.status === status) && matchesQuery(t, query));
}

function TasksListView({ index }: { index: TasksIndexSnapshot | null }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'any' | Status>('any');

  const tasks = useMemo(() => toTasksArray(index), [index]);
  const filtered = useMemo(() => filterTasks(tasks, query, status), [tasks, query, status]);

  const onAddTask = useCallback(async () => {
    try { await window.tasksIndex.openTaskCreate(); } catch (_) {}
  }, []);

  return (
    <section id="tasks-view">
      <h2 id="tasks-view-heading">Tasks</h2>
      <div className="tasks-controls" role="search">
        <div className="control">
          <label htmlFor="tasks-search-input">Search</label>
          <input
            id="tasks-search-input"
            type="search"
            placeholder="Search by id, title, or description"
            aria-label="Search tasks"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="control">
          <label htmlFor="tasks-status-select">Status</label>
          <select
            id="tasks-status-select"
            aria-label="Filter by status"
            value={status}
            onChange={(e) => setStatus((e.target.value || 'any') as any)}
          >
            <option value="any">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]} ({s})</option>
            ))}
          </select>
        </div>
        <div className="control control-buttons">
          <button
            type="button"
            className="btn-clear"
            onClick={() => { setQuery(''); setStatus('any'); }}
          >
            Clear
          </button>
        </div>
        <div className="control control-add-task">
          <button type="button" className="btn" onClick={onAddTask}>Add Task</button>
        </div>
      </div>

      <div id="tasks-count" className="tasks-count" aria-live="polite">
        Showing {filtered.length} of {tasks.length} tasks
      </div>

      <div id="tasks-results" className="tasks-results">
        {filtered.length === 0 ? (
          <div className="empty">No tasks found.</div>
        ) : (
          <ul className="tasks-list" role="list" aria-label="Tasks">
            {filtered.map((t, idx) => {
              const { done, total } = countFeatures(t);
              const go = () => { location.hash = `#task/${t.id}`; };
              return (
                <li key={t.id} className="task-item" role="listitem">
                  <div
                    className="task-row"
                    tabIndex={0}
                    role="button"
                    data-index={idx}
                    onClick={go}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault(); go();
                      }
                    }}
                    aria-label={`Task ${t.id}: ${t.title}. Status ${STATUS_LABELS[t.status]}. Features ${done} of ${total} done. Press Enter to view details.`}
                  >
                    <div className="col col-id">{t.id}</div>
                    <div className="col col-title">{t.title}</div>
                    <div className="col col-status"><StatusBadge status={t.status} /></div>
                    <div className="col col-features">{done}/{total}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

// ----- Task Details View (React) -----
function uniqueFeatureTitleSuggestions(index: TasksIndexSnapshot | null): string[] {
  const titles: string[] = [];
  if (!index || !index.tasksById) return titles;
  for (const task of Object.values(index.tasksById)) {
    const feats = Array.isArray(task.features) ? task.features : [];
    feats.forEach(f => { if (f?.title?.trim()) titles.push(f.title); });
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of titles) { if (!seen.has(t)) { seen.add(t); out.push(t); } }
  return out;
}

function resolveDependencies(raw: string[], task: Task, index: TasksIndexSnapshot | null) {
  if (!raw || raw.length === 0) return [] as string[];
  const out: string[] = [];
  const taskFeats = Array.isArray(task.features) ? task.features : [];
  const byIdCurrent = new Map(taskFeats.map(f => [f.id, f]));
  const byTitleCurrentCI = new Map(taskFeats.map(f => [String(f.title || '').toLowerCase(), f]));

  const byTitleGlobalCI = new Map<string, { id: string; taskId: number } | null>();
  if (index && index.tasksById) {
    for (const t of Object.values(index.tasksById)) {
      const feats = Array.isArray(t.features) ? t.features : [];
      for (const f of feats) {
        const key = String(f.title || '').toLowerCase();
        if (!key) continue;
        if (!byTitleGlobalCI.has(key)) byTitleGlobalCI.set(key, { id: f.id, taskId: t.id }); else {
          const prev = byTitleGlobalCI.get(key);
          if (!prev || prev.id !== f.id || prev.taskId !== t.id) byTitleGlobalCI.set(key, null);
        }
      }
    }
  }

  for (const dRaw of raw) {
    const d = String(dRaw || '').trim();
    if (!d) continue;
    if (byIdCurrent.has(d)) { out.push(d); continue; }
    const tMatch = byTitleCurrentCI.get(d.toLowerCase());
    if (tMatch) { out.push(tMatch.id); continue; }
    const g = byTitleGlobalCI.get(d.toLowerCase());
    if (g && g.id) { out.push(g.id); continue; }
    out.push(d);
  }
  return out;
}

function FeatureEditor({ task, feature, index, onCancel, onSaved }: {
  task: Task;
  feature: Feature;
  index: TasksIndexSnapshot | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(feature.status);
  const [title, setTitle] = useState(feature.title || '');
  const [description, setDescription] = useState(feature.description || '');
  const [plan, setPlan] = useState(feature.plan || '');
  const [context, setContext] = useState((feature.context || []).join('\n'));
  const [acceptance, setAcceptance] = useState((feature.acceptance || []).join('\n'));
  const [dependencies, setDependencies] = useState((feature.dependencies || []).join('\n'));
  const [rejection, setRejection] = useState(feature.rejection || '');

  const onSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const payload: Partial<Feature> = {
        status,
        title: title || '',
        description: description || '',
        plan: plan || '',
        context: (context || '').split('\n').map(s => s.trim()).filter(Boolean),
        acceptance: (acceptance || '').split('\n').map(s => s.trim()).filter(Boolean),
        dependencies: resolveDependencies((dependencies || '').split('\n').map(s => s.trim()).filter(Boolean), task, index),
        rejection: (rejection || '').trim(),
      };
      const res = await window.tasksIndex.updateFeature(task.id, feature.id, payload);
      if (!res || !res.ok) throw new Error(res?.error || 'Unknown error');
      onSaved();
    } catch (e: any) {
      alert(`Failed to save feature: ${e?.message || String(e)}`);
    } finally { setSaving(false); }
  }, [saving, status, title, description, plan, context, acceptance, dependencies, rejection, task, feature, index, onSaved]);

  return (
    <div className="feature-row editing" role="group" aria-label={`Editing Feature ${feature.id}`}>
      <div className="col col-id">{feature.id}</div>
      <div className="col col-form" style={{ flex: '1 1 auto' }}>
        <div className="feature-edit-form">
          <div className="form-row">
            <label htmlFor={`feat-${feature.id}-status`}>Status</label>
            <select id={`feat-${feature.id}-status`} value={status} onChange={(e) => setStatus(e.target.value as Status)}>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label htmlFor={`feat-${feature.id}-title`}>Title</label>
            <input id={`feat-${feature.id}-title`} type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="form-row">
            <label htmlFor={`feat-${feature.id}-desc`}>Description</label>
            <textarea id={`feat-${feature.id}-desc`} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="form-row">
            <label htmlFor={`feat-${feature.id}-plan`}>Plan</label>
            <textarea id={`feat-${feature.id}-plan`} rows={3} value={plan} onChange={(e) => setPlan(e.target.value)} />
          </div>
          <div className="form-row">
            <label htmlFor={`feat-${feature.id}-context`}>Context (one per row)</label>
            <textarea id={`feat-${feature.id}-context`} rows={4} value={context} onChange={(e) => setContext(e.target.value)} />
          </div>
          <div className="form-row">
            <label htmlFor={`feat-${feature.id}-acceptance`}>Acceptance (one per row)</label>
            <textarea id={`feat-${feature.id}-acceptance`} rows={4} value={acceptance} onChange={(e) => setAcceptance(e.target.value)} />
          </div>
          <div className="form-row">
            <label htmlFor={`feat-${feature.id}-deps`}>Dependencies (feature id or title; one per row)</label>
            <textarea id={`feat-${feature.id}-deps`} rows={3} value={dependencies} onChange={(e) => setDependencies(e.target.value)} />
          </div>
          <div className="form-row">
            <label htmlFor={`feat-${feature.id}-rejection`}>Rejection</label>
            <textarea id={`feat-${feature.id}-rejection`} rows={2} value={rejection} onChange={(e) => setRejection(e.target.value)} />
          </div>
          <div className="form-actions">
            <button type="button" className="btn-save" onClick={onSave} disabled={saving}>Save</button>
            <span className="spacer" />
            <button type="button" className="btn-cancel" onClick={onCancel} disabled={saving}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeaturesList({ task, index }: { task: Task; index: TasksIndexSnapshot | null }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const onAddFeature = useCallback(async () => {
    try { await window.tasksIndex.openFeatureCreate(task.id); } catch (_) {}
  }, [task.id]);

  if (!task.features || task.features.length === 0) {
    return (
      <div className="features-container">
        <div className="feature-create-controls">
          <button type="button" className="btn" onClick={onAddFeature}>Add Feature</button>
        </div>
        <div className="empty">No features defined for this task.</div>
      </div>
    );
  }

  return (
    <div className="features-container">
      <div className="feature-create-controls">
        <button type="button" className="btn" onClick={onAddFeature}>Add Feature</button>
      </div>
      <ul className="features-list" role="list" aria-label="Features">
        {task.features.map((f) => (
          <li key={f.id} className="feature-item" role="listitem">
            {editingId === f.id ? (
              <FeatureEditor
                task={task}
                feature={f}
                index={index}
                onCancel={() => setEditingId(null)}
                onSaved={() => setEditingId(null)}
              />
            ) : (
              <div className="feature-row" role="group" aria-label={`Feature ${f.id}: ${f.title}. Status ${STATUS_LABELS[f.status]}`}>
                <div className="col col-id">{f.id}</div>
                <div className="col col-title">{f.title}</div>
                <div className="col col-status"><StatusBadge status={f.status} /></div>
                <div className="col col-actions">
                  <button type="button" className="btn-edit" onClick={() => setEditingId(f.id)}>Edit</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TaskMeta({ task }: { task: Task }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(task.title || '');
  const [desc, setDesc] = useState(task.description || '');

  useEffect(() => {
    // Sync when task changes (route update)
    setTitle(task.title || '');
    setDesc(task.description || '');
    setEditing(false);
    setSaving(false);
  }, [task.id]);

  const onSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await window.tasksIndex.updateTask(task.id, { title, description: desc });
      if (!res || !res.ok) throw new Error(res?.error || 'Unknown error');
      setEditing(false);
    } catch (e: any) {
      alert(`Failed to update task: ${e?.message || String(e)}`);
    } finally { setSaving(false); }
  }, [saving, title, desc, task.id]);

  if (!editing) {
    return (
      <div className="task-meta">
        <div className="task-title">
          <h3>{task.title}</h3>
          <StatusBadge status={task.status} />
          <span className="spacer" />
          <button type="button" className="btn-edit-task" onClick={() => setEditing(true)}>Edit Task</button>
        </div>
        <div className="task-id"><strong>ID: </strong>{task.id}</div>
        <div className="task-desc">{task.description}</div>
      </div>
    );
  }

  return (
    <div className="task-meta editing">
      <div className="form-row">
        <label htmlFor={`task-${task.id}-title`}>Title</label>
        <input id={`task-${task.id}-title`} type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="form-row">
        <label htmlFor={`task-${task.id}-desc`}>Description</label>
        <textarea id={`task-${task.id}-desc`} rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} />
      </div>
      <div className="form-actions">
        <button type="button" className="btn-save" onClick={onSave} disabled={saving}>Save</button>
        <span className="spacer" />
        <button type="button" className="btn-cancel" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
      </div>
    </div>
  );
}

function TaskDetailsView({ index, taskId }: { index: TasksIndexSnapshot | null; taskId: number }) {
  const task = useMemo(() => {
    const t = index?.tasksById?.[String(taskId)] || null;
    return t as Task | null;
  }, [index, taskId]);

  const goBack = useCallback(() => { location.hash = ''; }, []);

  if (!task) {
    return (
      <section id="task-details-view">
        <h2 id="task-details-heading">Task {taskId}</h2>
        <div className="task-details-controls">
          <button type="button" className="btn-back" onClick={goBack}>Back to Tasks</button>
        </div>
        <div className="empty">Task {taskId} not found.</div>
      </section>
    );
  }

  return (
    <section id="task-details-view">
      <h2 id="task-details-heading">Task {task.id}</h2>
      <div className="task-details-controls">
        <button type="button" className="btn-back" onClick={goBack}>Back to Tasks</button>
      </div>
      <TaskMeta task={task} />
      <h3>Features</h3>
      <FeaturesList task={task} index={index} />
    </section>
  );
}

function App() {
  const index = useTasksIndex();
  const route = useRoute();

  return (
    <div>
      <h1>Tasks Indexer</h1>
      {route.name === 'details' ? (
        <TaskDetailsView index={index} taskId={route.id} />
      ) : (
        <TasksListView index={index} />
      )}
    </div>
  );
}

const container = document.getElementById('root')!;
const root = createRoot(container);
root.render(<App />);
