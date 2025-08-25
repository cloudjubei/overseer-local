import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';

const STATUS_LABELS = {
  '+': 'Done',
  '~': 'In Progress',
  '-': 'Pending',
  '?': 'Blocked',
  '=': 'Deferred',
} as const;

type Status = keyof typeof STATUS_LABELS;

const STATUS_OPTIONS: Status[] = ['+', '~', '-', '?', '='];

function toTasksArray(index: any) {
  const tasksById = index?.tasksById || {};
  const arr = Object.values(tasksById) as any[];
  arr.sort((a, b) => (a.id || 0) - (b.id || 0));
  return arr;
}

function computeNextTaskId(index: any) {
  const tasks = toTasksArray(index || {});
  let max = 0;
  for (const t of tasks) {
    const id = parseInt(t?.id || 0, 10);
    if (Number.isInteger(id) && id > max) max = id;
  }
  return (max + 1) || 1;
}

function TaskCreateView() {
  const [index, setIndex] = useState<any>(null);
  const [id, setId] = useState(1);
  const [status, setStatus] = useState<Status>('-');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchIndex = async () => {
      try {
        const idx = await window.tasksIndex.getSnapshot();
        setIndex(idx);
        setId(computeNextTaskId(idx));
        window.tasksIndex.onUpdate((newIdx: any) => {
          setIndex(newIdx);
          setId(prev => prev === computeNextTaskId(index) ? computeNextTaskId(newIdx) : prev);
        });
      } catch (e) {
        console.error(e);
      }
    };
    fetchIndex();
  }, []);

  const handleCreate = async () => {
    const idVal = parseInt(String(id), 10);
    if (!Number.isInteger(idVal) || idVal <= 0) {
      alert('Please provide a valid positive integer ID');
      return;
    }
    const payload = { id: idVal, status, title, description };
    setSaving(true);
    try {
      const res = await window.tasksIndex.addTask(payload);
      if (!res || !res.ok) throw new Error(res?.error || 'Unknown error');
      window.close();
    } catch (e) {
      alert(`Failed to create task: ${e.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div id="task-create-view" role="region" aria-labelledby="task-create-heading">
      <h2 id="task-create-heading">Create Task</h2>
      <div className="task-create-form">
        <div className="form-row">
          <label htmlFor="newtask-id">ID</label>
          <input id="newtask-id" type="number" value={id} onChange={(e) => setId(parseInt(e.target.value) || 1)} min={1} step={1} aria-label="Task ID" />
        </div>
        <div className="form-row">
          <label htmlFor="newtask-status">Status</label>
          <select id="newtask-status" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            {STATUS_OPTIONS.map(s => <option key={s} value={s} selected={s === '-'}>{STATUS_LABELS[s]} ({s})</option>)}
          </select>
        </div>
        <div className="form-row">
          <label htmlFor="newtask-title">Title</label>
          <input id="newtask-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" aria-label="Task Title" />
        </div>
        <div className="form-row">
          <label htmlFor="newtask-desc">Description</label>
          <textarea id="newtask-desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" aria-label="Task Description" />
        </div>
        <div className="form-actions">
          <button type="button" className="btn-save" disabled={saving} onClick={handleCreate}>Create</button>
          <span className="spacer" />
          <button type="button" className="btn-cancel" disabled={saving} onClick={() => window.close()}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<TaskCreateView />);
