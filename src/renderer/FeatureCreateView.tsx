import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';

function parseTaskId() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('taskId');
  if (fromQuery && /^\d+$/.test(fromQuery)) return parseInt(fromQuery, 10);
  const m = /^#?task\/(\d+)$/.exec(window.location.hash || '');
  if (m) return parseInt(m[1], 10);
  return null;
}

function FeatureCreateView() {
  const taskId = parseTaskId();
  if (!taskId || !Number.isInteger(taskId)) {
    return <p>Error: No Task ID provided. This window should be opened from a task details page.</p>;
  }

  const [status, setStatus] = useState('-');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [plan, setPlan] = useState('');
  const [context, setContext] = useState('');
  const [acceptance, setAcceptance] = useState('');
  const [dependencies, setDependencies] = useState('');
  const [rejection, setRejection] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) {
      alert('Title is required.');
      return;
    }
    const newFeature = {
      status,
      title,
      description,
      plan,
      context: context.split('\n').map(s => s.trim()).filter(s => s !== ''),
      acceptance: acceptance.split('\n').map(s => s.trim()).filter(s => s !== ''),
      dependencies: dependencies.split('\n').map(s => s.trim()).filter(s => s !== ''),
      rejection: rejection.trim() || undefined,
    };
    try {
      const res = await window.tasksIndex.addFeature(taskId, newFeature);
      if (!res || !res.ok) throw new Error(res?.error || 'Unknown error');
      window.close();
    } catch (error) {
      alert(`Error adding feature: ${error.message || error}`);
    }
  };

  return (
    <div className="container">
      <h1>Create New Feature</h1>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="title">Title</label>
          <input type="text" id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="form-group">
          <label htmlFor="status">Status</label>
          <select id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="-">Pending</option>
            <option value="~">In Progress</option>
            <option value="+">Done</option>
            <option value="?">Blocked</option>
            <option value="=">Deferred</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="plan">Plan</label>
          <textarea id="plan" rows={5} value={plan} onChange={(e) => setPlan(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="context">Context (one item per line)</label>
          <textarea id="context" rows={3} value={context} onChange={(e) => setContext(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="acceptance">Acceptance Criteria (one item per line)</label>
          <textarea id="acceptance" rows={3} value={acceptance} onChange={(e) => setAcceptance(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="dependencies">Dependencies (one item per line)</label>
          <textarea id="dependencies" rows={2} value={dependencies} onChange={(e) => setDependencies(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="rejection">Rejection Reason</label>
          <textarea id="rejection" rows={2} value={rejection} onChange={(e) => setRejection(e.target.value)} />
        </div>
        <div className="form-actions">
          <button type="button" onClick={() => window.close()}>Cancel</button>
          <button type="submit">Save Feature</button>
        </div>
      </form>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<FeatureCreateView />);
