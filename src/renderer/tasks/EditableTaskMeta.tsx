import React, { useState } from 'react';

// Define the shape of the props this component will accept
interface EditableTaskMetaProps {
  task: {
    id: number;
    title: string;
    description: string;
  };
  onSave: (payload: { title: string; description: string }) => void;
  onCancel: () => void;
  isSaving: boolean;
}

export default function EditableTaskMeta({ task, onSave, onCancel, isSaving }: EditableTaskMetaProps) {
  // Hooks are now at the top level of THIS component, which is correct.
  const [title, setTitle] = useState(task.title || '');
  const [description, setDescription] = useState(task.description || '');

  const handleSaveClick = () => {
    onSave({ title, description });
  };

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
        <button type="button" className="btn-save" disabled={isSaving} onClick={handleSaveClick}>Save</button>
        <span className="spacer" />
        <button type="button" className="btn-cancel" disabled={isSaving} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}