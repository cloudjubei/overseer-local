import { parseTaskIdFromLocation } from './utils/routing.js';

document.addEventListener('DOMContentLoaded', () => {
  const taskId = parseTaskIdFromLocation();

  const form = document.getElementById('feature-form');
  const cancelButton = document.getElementById('cancel-button');

  if (!taskId || !Number.isInteger(taskId)) {
    console.error('No valid taskId provided in URL');
    form.innerHTML = '<p>Error: No Task ID provided. This window should be opened from a task details page.</p>';
    return;
  }

  cancelButton.addEventListener('click', () => {
    window.close();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(form);

    const newFeature = {
      status: formData.get('status'),
      title: String(formData.get('title') || ''),
      description: String(formData.get('description') || ''),
      plan: String(formData.get('plan') || ''),
      context: String(formData.get('context') || '')
        .split('\n')
        .map(s => s.trim())
        .filter(s => s !== ''),
      acceptance: String(formData.get('acceptance') || '')
        .split('\n')
        .map(s => s.trim())
        .filter(s => s !== ''),
      dependencies: String(formData.get('dependencies') || '')
        .split('\n')
        .map(s => s.trim())
        .filter(s => s !== ''),
    };

    const rejection = String(formData.get('rejection') || '').trim();
    if (rejection) {
      newFeature.rejection = rejection;
    }

    if (!newFeature.title) {
      alert('Title is required.');
      return;
    }

    try {
      const res = await window.tasksIndex.addFeature(taskId, newFeature);
      if (!res || !res.ok) throw new Error(res && res.error ? res.error : 'Unknown error');
      window.close();
    } catch (error) {
      console.error('Failed to add feature:', error);
      alert(`Error adding feature: ${error.message || error}`);
    }
  });
});
