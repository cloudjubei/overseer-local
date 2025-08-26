import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal } from './components/ui';

type Status = '+' | '~' | '-' | '?' | '=';
const STATUS_LABELS: Record<Status, string> = {
  '+': 'Done', '~': 'In Progress', '-': 'Pending', '?': 'Blocked', '=': 'Deferred'
};

function useNextTaskId() {
  const [nextId, setNextId] = useState<number>(1);
  useEffect(() => {
    let unsub: null | (() => void) = null;
    (async () => {
      try {
        const idx = await window.tasksIndex.getSnapshot();
        const ids = Object.values(idx?.tasksById || {}).map(t => t.id).filter((n) => Number.isInteger(n));
        const max = ids.length > 0 ? Math.max(...ids) : 0;
        setNextId((max + 1) || 1);
      } catch (_) {}
      try {
        unsub = window.tasksIndex.onUpdate((i) => {
          const ids = Object.values(i?.tasksById || {}).map((t: any) => t.id).filter((n: any) => Number.isInteger(n));
          const max = ids.length > 0 ? Math.max(...ids) : 0;
          setNextId((max + 1) || 1);
        });
      } catch (_) {}
    })();
    return () => { try { unsub && unsub(); } catch (_) {} };
  }, []);
  return nextId;
}

export default function TaskCreateView() {
  const defaultId = useNextTaskId();
  const [id, setId] = useState<number | ''>('');
  const [status, setStatus] = useState<Status>('-');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // initialize id if empty when default computed
    if (id === '' && defaultId) setId(defaultId);
  }, [defaultId]);

  const onCancel = useCallback(() => window.close(), []);

  const onCreate = useCallback(async () => {
    const idVal = typeof id === 'number' ? id : parseInt(String(id || ''), 10);
    if (!Number.isInteger(idVal) || idVal <= 0) {
      alert('Please provide a valid positive integer ID');
      return;
    }
    setSubmitting(true);
    try {
      const res = await window.tasksIndex.addTask({ id: idVal, status, title: title || '', description: description || '' });
      if (!res || !res.ok) throw new Error(res?.error || 'Unknown error');
      window.close();
    } catch (e: any) {
      alert(`Failed to create task: ${e?.message || String(e)}`);
    } finally {
      setSubmitting(false);
    }
  }, [id, status, title, description]);

  return (
    <Modal title="Create New Task" onClose={() => window.close()} isOpen={true}>
      <div className="task-create-form">
        <div className="form-row">
          <label htmlFor="newtask-id">ID</label>
          <input id="newtask-id" type="number" min={1} step={1} value={id} onChange={(e) => setId(e.target.value === '' ? '' : parseInt(e.target.value, 10))} />
        </div>
        <div className="form-row">
          <label htmlFor="newtask-status">Status</label>
          <select id="newtask-status" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            {(['+', '~', '-', '?', '='] as Status[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]} ({s})</option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label htmlFor="newtask-title">Title</label>
          <input id="newtask-title" type="text" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="form-row">
          <label htmlFor="newtask-desc">Description</label>
          <textarea id="newtask-desc" rows={4} placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={submitting}>Cancel</button>
          <button type="button" className="btn" onClick={onCreate} disabled={submitting}>Create</button>
        </div>
      </div>
    </Modal>
  );
}
