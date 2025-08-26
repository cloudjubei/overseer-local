import React, { useEffect, useState, useCallback } from 'react';
import EditableTaskMeta from './EditableTaskMeta'; // <-- Import the new component

// --- UTILITY FUNCTIONS AND CONSTANTS (UNCHANGED) ---

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

// NOTE: StringListEditor component would ideally be in its own file too.
// For now, it's kept here as it was in the original file.
function StringListEditor({ idBase, label, initial = [], placeholder = '', suggestions = [], onChange }: any) {
  const [rows, setRows] = useState(initial.length === 0 ? [''] : initial);

  useEffect(() => {
    onChange(rows.filter((v: string) => v.trim() !== ''));
  }, [rows, onChange]);

  const addRow = () => setRows((prev: string[]) => [...prev, '']);
  const removeRow = (index: number) => setRows((prev: string[]) => prev.filter((_, i) => i !== index));
  const updateRow = (index: number, value: string) => setRows((prev: string[]) => prev.map((v, i) => i === index ? value : v));

  const datalistId = suggestions.length ? `${idBase}-datalist` : undefined;

  return (
    <div className="string-list">
      <label>{label}</label>
      <ul className="string-list-rows">
        {rows.map((value: string, index: number) => (
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
          {suggestions.map((s: string) => <option key={s} value={s} />)}
        </datalist>
      )}
    </div>
  );
}


function featureSuggestionsTitles(index: any) {
  // ... (This function is correct, no changes needed)
  return []; // Placeholder
}

function resolveDependencies(deps: string[], task: any, index: any) {
  // ... (This function is correct, no changes needed)
  return []; // Placeholder
}


// --- NEW COMPONENT FOR THE FEATURE EDITING FORM ---

function EditableFeatureRow({ feature, task, index, onSave, onCancel, isSaving }: any) {
  // All hooks are now correctly at the top level of this component
  const [status, setStatus] = useState(feature.status);
  const [title, setTitle] = useState(feature.title || '');
  const [description, setDescription] = useState(feature.description || '');
  const [plan, setPlan] = useState(feature.plan || '');
  const [context, setContext] = useState<string[]>(feature.context || []);
  const [acceptance, setAcceptance] = useState<string[]>(feature.acceptance || []);
  const [dependencies, setDependencies] = useState<string[]>(feature.dependencies || []);
  const [rejection, setRejection] = useState(feature.rejection || '');

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
    onSave(feature.id, payload);
  };

  // The JSX for the form is moved here from the old render function
  return (
    <div className="feature-row editing" role="group" aria-label={`Editing Feature ${feature.id}`}>
      <div className="col col-id">{feature.id || ''}</div>
      <div className="col col-form" style={{ flex: '1 1 auto' }}>
        <div className="feature-edit-form">
          <div className="form-row">
            <label htmlFor={`feat-${feature.id}-status`}>Status</label>
            <select id={`feat-${feature.id}-status`} aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]} ({s})</option>)}
            </select>
          </div>
          <div className="form-row">
            <label htmlFor={`feat-${feature.id}-title`}>Title</label>
            <input id={`feat-${feature.id}-title`} type="text" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title" />
          </div>
          <div className="form-row">
            <label htmlFor={`feat-${feature.id}-desc`}>Description</label>
            <textarea id={`feat-${feature.id}-desc`} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} aria-label="Description" />
          </div>
          <div className="form-row">
            <label htmlFor={`feat-${feature.id}-plan`}>Plan</label>
            <textarea id={`feat-${feature.id}-plan`} rows={3} value={plan} onChange={(e) => setPlan(e.target.value)} aria-label="Plan" />
          </div>
          <div className="form-row">
            <StringListEditor idBase={`feat-${feature.id}-context`} label="Context (one per row)" initial={context} placeholder="Context item" onChange={setContext} />
          </div>
          <div className="form-row">
            <StringListEditor idBase={`feat-${feature.id}-acceptance`} label="Acceptance (one per row)" initial={acceptance} placeholder="Acceptance criterion" onChange={setAcceptance} />
          </div>
          <div className="form-row">
            <StringListEditor idBase={`feat-${feature.id}-deps`} label="Dependencies (feature id or title; one per row)" initial={dependencies} placeholder="Feature id or title" suggestions={depSuggestions} onChange={setDependencies} />
          </div>
          <div className="form-row">
            <label htmlFor={`feat-${feature.id}-rejection`}>Rejection</label>
            <textarea id={`feat-${feature.id}-rejection`} rows={2} value={rejection} onChange={(e) => setRejection(e.target.value)} aria-label="Rejection (optional)" />
          </div>
          <div className="form-actions">
            <button type="button" className="btn-save" disabled={isSaving} onClick={handleSave}>Save</button>
            <span className="spacer" />
            <button type="button" className="btn-cancel" disabled={isSaving} onClick={onCancel}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}


// --- MAIN VIEW COMPONENT (REFACTORED) ---

export default function TaskDetailsView({ taskId }: { taskId: number }) {
  const [index, setIndex] = useState<any>(null);
  const [task, setTask] = useState<any>(null);
  const [editFeatureId, setEditFeatureId] = useState<string | null>(null);
  const [taskEditing, setTaskEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchIndex = async () => {
      try {
        const idx = await (window as any).tasksIndex.getSnapshot();
        setIndex(idx);
        (window as any).tasksIndex.onUpdate(setIndex);
      } catch (e) {
        console.error(e);
      }
    };
    fetchIndex();
  }, []);

  useEffect(() => {
    if (taskId && index && index.tasksById) {
      const t = index.tasksById?.[taskId];
      setTask(t);
    }
  }, [taskId, index]);

  const handleSaveFeature = async (featureId: string, payload: any) => {
    setSaving(true);
    try {
      const res = await (window as any).tasksIndex.updateFeature(task.id, featureId, payload);
      if (!res || !res.ok) throw new Error(res?.error || 'Unknown error');
      setEditFeatureId(null);
    } catch (e: any) {
      alert(`Failed to save feature: ${e.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTask = async (payload: { title: string; description: string }) => {
    setSaving(true);
    try {
      const res = await (window as any).tasksIndex.updateTask(task.id, payload);
      if (!res || !res.ok) throw new Error(res?.error || 'Unknown error');
      setTaskEditing(false);
    } catch (e: any) {
      alert(`Failed to update task: ${e.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAddFeature = async () => {
    try {
      await (window as any).tasksIndex.openFeatureCreate(task.id);
    } catch (e) {
      console.error(e);
    }
  };

  if (!task) return <div className="empty">Task {taskId} not found. <button onClick={() => location.hash = ''}>Back to Tasks</button></div>;

  const features = task.features || [];

  return (
    <section id="task-details-view" role="region" aria-labelledby="task-details-heading">
      <h2 id="task-details-heading">Task {task.id}</h2>
      <div className="task-details-controls">
        <button type="button" className="btn-back" onClick={() => { setTaskEditing(false); location.hash = ''; }}>Back to Tasks</button>
      </div>
      
      {taskEditing ? (
        <EditableTaskMeta
          task={task}
          onSave={handleSaveTask}
          onCancel={() => setTaskEditing(false)}
          isSaving={saving}
        />
      ) : (
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
      )}

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
                {editFeatureId === f.id ? (
                  <EditableFeatureRow
                    feature={f}
                    task={task}
                    index={index}
                    onSave={handleSaveFeature}
                    onCancel={() => setEditFeatureId(null)}
                    isSaving={saving}
                  />
                ) : (
                  <div className="feature-row" role="group" aria-label={`Feature ${f.id}: ${f.title}. Status ${STATUS_LABELS[f.status as Status] || f.status}`}>
                    <div className="col col-id">{f.id || ''}</div>
                    <div className="col col-title">{f.title || ''}</div>
                    <div className="col col-status"><StatusBadge status={f.status} /></div>
                    <div className="col col-actions">
                      <button type="button" className="btn-edit" onClick={() => setEditFeatureId(f.id)}>Edit</button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}