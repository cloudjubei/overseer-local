import React, { useEffect, useState, useCallback } from 'react';

const STATUS_LABELS = {
  '+': 'Done',
  '~': 'In Progress',
  '-': 'Pending',
  '?': 'Blocked',
  '=': 'Deferred',
} as const;

type Status = keyof typeof STATUS_LABELS;

const STATUS_OPTIONS: Status[] = ['+', '~', '-', '?', '='];

function cssStatus(status: string) {
  switch (status) {
    case '+': return 'done';
    case '~': return 'inprogress';
    case '-': return 'pending';
    case '?': return 'blocked';
    case '=': return 'deferred';
    default: return 'unknown';
  }
}

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status as Status] || String(status || '');
  return <span className={`status-badge status-${cssStatus(status)}`} role="img" aria-label={label}>{label}</span>;
}

function parseRoute(hash: string) {
  const m = /^#task\/(\d+)$/.exec(hash || '');
  if (m) return { name: 'details', id: parseInt(m[1], 10) };
  return { name: 'list' };
}

type StringListEditorProps = {
  idBase: string;
  label: string;
  initial?: string[];
  placeholder?: string;
  suggestions?: string[];
  onChange: (values: string[]) => void;
};

function StringListEditor({ idBase, label, initial = [], placeholder = '', suggestions = [], onChange }: StringListEditorProps) {
  const [rows, setRows] = useState(initial.length === 0 ? [''] : initial);

  useEffect(() => {
    onChange(rows.filter(v => v.trim() !== ''));
  }, [rows, onChange]);

  const addRow = () => setRows(prev => [...prev, '']);
  const removeRow = (index: number) => setRows(prev => prev.filter((_, i) => i !== index));
  const updateRow = (index: number, value: string) => setRows(prev => prev.map((v, i) => i === index ? value : v));

  const datalistId = suggestions.length ? `${idBase}-datalist` : undefined;

  return (
    <div className="string-list">
      <label>{label}</label>
      <ul className="string-list-rows">
        {rows.map((value, index) => (
          <li key={index} className="string-list-row">
            <input
              type="text"
              value={value}
              placeholder={placeholder}
              list={datalistId}
              onChange={(e) => updateRow(index, e.target.value)}
            />
            <button type="button" className="btn-remove-row" onClick={() => removeRow(index)}>Remove</button>
          </li>
        ))}
      </ul>
      <button type="button" className="btn-add-row" onClick={addRow}>Add row</button>
      {datalistId && (
        <datalist id={datalistId}>
          {suggestions.map(s => <option key={s} value={s} />)}
        </datalist>
      )}
    </div>
  );
}

function featureSuggestionsTitles(index: any) {
  const titles: string[] = [];
  if (!index || !index.tasksById) return titles;
  for (const task of Object.values(index.tasksById)) {
    const feats = Array.isArray((task as any).features) ? (task as any).features : [];
    feats.forEach((f: any) => {
      if (f && typeof f.title === 'string' && f.title.trim()) titles.push(f.title);
    });
  }
  const seen = new Set();
  return titles.filter(t => {
    if (seen.has(t)) return false;
    seen.add(t);
    return true;
  });
}

function resolveDependencies(deps: string[], task: any, index: any) {
  if (!Array.isArray(deps) || deps.length === 0) return [];
  const out: string[] = [];
  const taskFeatures = Array.isArray(task.features) ? task.features : [];

  const byIdCurrent = new Map(taskFeatures.map((f: any) => [f.id, f]));
  const byTitleCurrentCI = new Map(taskFeatures.map((f: any) => [String(f.title || '').toLowerCase(), f]));

  const byTitleGlobalCI = new Map();
  if (index && index.tasksById) {
    for (const t of Object.values(index.tasksById)) {
      const feats = Array.isArray((t as any).features) ? (t as any).features : [];
      for (const f of feats) {
        const key = String(f.title || '').toLowerCase();
        if (!key) continue;
        if (!byTitleGlobalCI.has(key)) byTitleGlobalCI.set(key, { id: f.id, taskId: (t as any).id });
        else {
          const prev = byTitleGlobalCI.get(key);
          if (prev && (prev.id !== f.id || prev.taskId !== (t as any).id)) byTitleGlobalCI.set(key, null);
        }
      }
    }
  }

  for (const dRaw of deps) {
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

function TaskDetailsView({ hash }: { hash: string }) {
  const route = parseRoute(hash);
  const [index, setIndex] = useState<any>(null);
  const [task, setTask] = useState<any>(null);
  const [editFeatureId, setEditFeatureId] = useState<string | null>(null);
  const [taskEditing, setTaskEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchIndex = async () => {
      try {
        const idx = await window.tasksIndex.getSnapshot();
        setIndex(idx);
        window.tasksIndex.onUpdate(setIndex);
      } catch (e) {
        console.error(e);
      }
    };
    fetchIndex();
  }, []);

  useEffect(() => {
    if (index && route.name === 'details') {
      const t = index.tasksById?.[String(route.id)];
      setTask(t);
    }
  }, [index, route]);

  if (route.name !== 'details') return null;
  if (!task) return <div className="empty">Task {route.id} not found. <button onClick={() => location.hash = ''}>Back to Tasks</button></div>;

  const handleSaveFeature = async (featureId: string, payload: any) => {
    setSaving(true);
    try {
      const res = await window.tasksIndex.updateFeature(task.id, featureId, payload);
      if (!res || !res.ok) throw new Error(res?.error || 'Unknown error');
      setEditFeatureId(null);
    } catch (e) {
      alert(`Failed to save feature: ${e.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTask = async (payload: { title: string; description: string }) => {
    setSaving(true);
    try {
      const res = await window.tasksIndex.updateTask(task.id, payload);
      if (!res || !res.ok) throw new Error(res?.error || 'Unknown error');
      setTaskEditing(false);
    } catch (e) {
      alert(`Failed to update task: ${e.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAddFeature = async () => {
    try {
      await window.tasksIndex.openFeatureCreate(task.id);
    } catch (e) {
      console.error(e);
    }
  };

  const renderTaskMeta = () => {
    if (!taskEditing) {
      return (
        <div className="task-meta">
          <div className="task-title">
            <h3>{task.title || ''}</h3>
            <StatusBadge status={task.status} />
            <span className="spacer" />
            <button type="button" className="btn-edit-task" onClick={() => setTaskEditing(true)}>Edit Task</button>
          </div>
          <div className="task-id"><strong>ID: </strong>{String(task.id)}</div>
          <div className="task-desc">{task.description || ''}</div>
        </div>
      );
    }

    const [title, setTitle] = useState(task.title || '');
    const [description, setDescription] = useState(task.description || '');

    return (
      <div className="task-meta editing">
        <div className="form-row">
          <label htmlFor={`task-${task.id}-title`}>Title</label>
          <input id={`task-${task.id}-title`} type="text" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Task Title" />
        </div>
        <div className="form-row">
          <label htmlFor={`task-${task.id}-desc`}>Description</label>
          <textarea id={`task-${task.id}-desc`} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} aria-label="Task Description" />
        </div>
        <div className="form-actions">
          <button type="button" className="btn-save" disabled={saving} onClick={() => handleSaveTask({ title, description })}>Save</button>
          <span className="spacer" />
          <button type="button" className="btn-cancel" disabled={saving} onClick={() => setTaskEditing(false)}>Cancel</button>
        </div>
      </div>
    );
  };

  const renderFeatureRow = (f: any) => {
    const isEditing = editFeatureId === f.id;
    if (!isEditing) {
      return (
        <div className="feature-row" role="group" aria-label={`Feature ${f.id}: ${f.title}. Status ${STATUS_LABELS[f.status as Status] || f.status}`}>
          <div className="col col-id">{f.id || ''}</div>
          <div className="col col-title">{f.title || ''}</div>
          <div className="col col-status"><StatusBadge status={f.status} /></div>
          <div className="col col-actions">
            <button type="button" className="btn-edit" onClick={() => setEditFeatureId(f.id)}>Edit</button>
          </div>
        </div>
      );
    }

    const [status, setStatus] = useState(f.status);
    const [title, setTitle] = useState(f.title || '');
    const [description, setDescription] = useState(f.description || '');
    const [plan, setPlan] = useState(f.plan || '');
    const [context, setContext] = useState<string[]>(f.context || []);
    const [acceptance, setAcceptance] = useState<string[]>(f.acceptance || []);
    const [dependencies, setDependencies] = useState<string[]>(f.dependencies || []);
    const [rejection, setRejection] = useState(f.rejection || '');

    const depSuggestions = featureSuggestionsTitles(index);

    const handleSave = () => {
      const payload = {
        status,
        title,
        description,
        plan,
        context,
        acceptance,
        dependencies: resolveDependencies(dependencies, task, index),
        rejection: rejection.trim() || undefined,
      };
      handleSaveFeature(f.id, payload);
    };

    return (
      <div className="feature-row editing" role="group" aria-label={`Editing Feature ${f.id}`}>
        <div className="col col-id">{f.id || ''}</div>
        <div className="col col-form" style={{ flex: '1 1 auto' }}>
          <div className="feature-edit-form">
            <div className="form-row">
              <label htmlFor={`feat-${f.id}-status`}>Status</label>
              <select id={`feat-${f.id}-status`} aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]} ({s})</option>)}
              </select>
            </div>
            <div className="form-row">
              <label htmlFor={`feat-${f.id}-title`}>Title</label>
              <input id={`feat-${f.id}-title`} type="text" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title" />
            </div>
            <div className="form-row">
              <label htmlFor={`feat-${f.id}-desc`}>Description</label>
              <textarea id={`feat-${f.id}-desc`} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} aria-label="Description" />
            </div>
            <div className="form-row">
              <label htmlFor={`feat-${f.id}-plan`}>Plan</label>
              <textarea id={`feat-${f.id}-plan`} rows={3} value={plan} onChange={(e) => setPlan(e.target.value)} aria-label="Plan" />
            </div>
            <div className="form-row">
              <StringListEditor idBase={`feat-${f.id}-context`} label="Context (one per row)" initial={context} placeholder="Context item" onChange={setContext} />
            </div>
            <div className="form-row">
              <StringListEditor idBase={`feat-${f.id}-acceptance`} label="Acceptance (one per row)" initial={acceptance} placeholder="Acceptance criterion" onChange={setAcceptance} />
            </div>
            <div className="form-row">
              <StringListEditor idBase={`feat-${f.id}-deps`} label="Dependencies (feature id or title; one per row)" initial={dependencies} placeholder="Feature id or title" suggestions={depSuggestions} onChange={setDependencies} />
            </div>
            <div className="form-row">
              <label htmlFor={`feat-${f.id}-rejection`}>Rejection</label>
              <textarea id={`feat-${f.id}-rejection`} rows={2} value={rejection} onChange={(e) => setRejection(e.target.value)} aria-label="Rejection (optional)" />
            </div>
            <div className="form-actions">
              <button type="button" className="btn-save" disabled={saving} onClick={handleSave}>Save</button>
              <span className="spacer" />
              <button type="button" className="btn-cancel" disabled={saving} onClick={() => setEditFeatureId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const features = task.features || [];

  return (
    <section id="task-details-view" role="region" aria-labelledby="task-details-heading">
      <h2 id="task-details-heading">Task {task.id}</h2>
      <div className="task-details-controls">
        <button type="button" className="btn-back" onClick={() => { setTaskEditing(false); location.hash = ''; }}>Back to Tasks</button>
      </div>
      {renderTaskMeta()}
      <h3>Features</h3>
      <div className="features-container">
        <div className="feature-create-controls">
          <button type="button" className="btn-add-feature" onClick={handleAddFeature}>Add Feature</button>
        </div>
        {features.length === 0 ? (
          <div className="empty">No features defined for this task.</div>
        ) : (
          <ul className="features-list" role="list" aria-label="Features">
            {features.map((f: any) => (
              <li key={f.id} className="feature-item" role="listitem">
                {renderFeatureRow(f)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default TaskDetailsView;
