import React, { useCallback, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

type Status = '+' | '~' | '-' | '?' | '=';

const STATUS_LABELS: Record<Status, string> = {
  '+': 'Done',
  '~': 'In Progress',
  '-': 'Pending',
  '?': 'Blocked',
  '=': 'Deferred',
};

function useTaskId(): number | null {
  return useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('taskId');
    if (fromQuery && /^\d+$/.test(fromQuery)) return parseInt(fromQuery, 10);
    const m = /^#?task\/(\d+)$/.exec(window.location.hash || '');
    if (m) return parseInt(m[1], 10);
    return null;
  }, []);
}

function FeatureCreateView() {
  const taskId = useTaskId();
  const [status, setStatus] = useState<Status>('-');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [plan, setPlan] = useState('');
  const [context, setContext] = useState('');
  const [acceptance, setAcceptance] = useState('');
  const [dependencies, setDependencies] = useState('');
  const [rejection, setRejection] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskId || !Number.isInteger(taskId)) {
      alert('No valid Task ID provided.');
      return;
    }
    if (!title.trim()) {
      alert('Title is required.');
      return;
    }
    const payload: any = {
      status,
      title: title.trim(),
      description,
      plan,
      context: context.split('\n').map(s => s.trim()).filter(Boolean),
      acceptance: acceptance.split('\n').map(s => s.trim()).filter(Boolean),
      dependencies: dependencies.split('\n').map(s => s.trim()).filter(Boolean),
    };
    const rej = rejection.trim(); if (rej) payload.rejection = rej;

    try {
      setSubmitting(true);
      const res = await (window as any).tasksIndex.addFeature(taskId, payload);
      if (!res || !res.ok) throw new Error(res && res.error ? res.error : 'Unknown error');
      window.close();
    } catch (err: any) {
      alert(`Error adding feature: ${err?.message || String(err)}`);
    } finally {
      setSubmitting(false);
    }
  }, [taskId, status, title, description, plan, context, acceptance, dependencies, rejection]);

  if (!taskId) {
    return <div className="container"><p>Error: No Task ID provided. This window should be opened from a task details page.</p></div>;
  }

  return (
    <div className="container">
      <h2>Create New Feature</h2>
      <form onSubmit={onSubmit} id="feature-form">
        <div className="form-group">
          <label htmlFor="status">Status</label>
          <select id="status" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            {(['+', '~', '-', '?', '='] as Status[]).map(s => (
              <option key={s} value={s}>{STATUS_LABELS[s]} ({s})</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="title">Title</label>
          <input id="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="plan">Plan</label>
          <textarea id="plan" rows={3} value={plan} onChange={(e) => setPlan(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="context">Context (one per line)</label>
          <textarea id="context" rows={4} value={context} onChange={(e) => setContext(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="acceptance">Acceptance (one per line)</label>
          <textarea id="acceptance" rows={4} value={acceptance} onChange={(e) => setAcceptance(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="dependencies">Dependencies (feature id or title; one per line)</label>
          <textarea id="dependencies" rows={3} value={dependencies} onChange={(e) => setDependencies(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="rejection">Rejection (optional)</label>
          <textarea id="rejection" rows={2} value={rejection} onChange={(e) => setRejection(e.target.value)} />
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => window.close()} disabled={submitting}>Cancel</button>
          <button type="submit" className="btn" disabled={submitting}>Create Feature</button>
        </div>
      </form>
    </div>
  );
}

const container = document.getElementById('root')!;
const root = createRoot(container);
root.render(<FeatureCreateView />);
