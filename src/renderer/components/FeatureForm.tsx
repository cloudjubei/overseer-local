import React, { useState } from 'react';

type Status = '+' | '~' | '-' | '?' | '=';
const STATUS_LABELS: Record<Status, string> = {
  '+': 'Done', '~': 'In Progress', '-': 'Pending', '?': 'Blocked', '=': 'Deferred'
};

export type FeatureFormValues = {
  status: Status;
  title: string;
  description: string;
  plan: string;
  context: string[];
  acceptance: string[];
  dependencies: string[];
  rejection?: string;
};

type FeatureFormProps = {
  initialValues?: FeatureFormValues;
  onSubmit: (values: FeatureFormValues) => void;
  onCancel: () => void;
  submitting: boolean;
  isCreate: boolean;
};

export function FeatureForm({ initialValues = {}, onSubmit, onCancel, submitting, isCreate }: FeatureFormProps) {
  const [status, setStatus] = useState<Status>(initialValues.status ?? '-');
  const [title, setTitle] = useState(initialValues.title ?? '');
  const [description, setDescription] = useState(initialValues.description ?? '');
  const [plan, setPlan] = useState(initialValues.plan ?? '');
  const [context, setContext] = useState(initialValues.context?.join('\n') ?? '');
  const [acceptance, setAcceptance] = useState(initialValues.acceptance?.join('\n') ?? '');
  const [dependencies, setDependencies] = useState(initialValues.dependencies?.join('\n') ?? '');
  const [rejection, setRejection] = useState(initialValues.rejection ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      status,
      title: title.trim(),
      description: description.trim(),
      plan: plan.trim(),
      context: context.split('\n').map(s => s.trim()).filter(Boolean),
      acceptance: acceptance.split('\n').map(s => s.trim()).filter(Boolean),
      dependencies: dependencies.split('\n').map(s => s.trim()).filter(Boolean),
      rejection: rejection.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="feature-form">
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
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={submitting}>Cancel</button>
        <button type="submit" className="btn" disabled={submitting}>{isCreate ? 'Create' : 'Save'}</button>
      </div>
    </form>
  );
}
