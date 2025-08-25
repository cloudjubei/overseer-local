document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('root');
  if (!root) {
    console.error('#root element not found');
    return;
  }

  const form = document.createElement('form');
  form.className = 'feature-form';
  form.style.padding = '20px';
  form.style.display = 'flex';
  form.style.flexDirection = 'column';
  form.style.gap = '10px';
  
  form.innerHTML = `
    <h2>Create New Feature</h2>
    <div class="form-group">
      <label for="title" style="display: block; margin-bottom: 5px;">Title</label>
      <input type="text" id="title" required style="width: 100%; padding: 8px; box-sizing: border-box;">
    </div>
    <div class="form-group">
      <label for="description" style="display: block; margin-bottom: 5px;">Description</label>
      <textarea id="description" rows="3" style="width: 100%; padding: 8px; box-sizing: border-box;"></textarea>
    </div>
    <div class="form-group">
      <label for="status" style="display: block; margin-bottom: 5px;">Status</label>
      <select id="status" style="width: 100%; padding: 8px; box-sizing: border-box;">
        <option value="-">- (Pending)</option>
        <option value="+">+ (Done)</option>
        <option value="~">~ (In Progress)</option>
        <option value="?">? (Blocked)</option>
        <option value="=">= (Deferred)</option>
      </select>
    </div>
    <div class="form-group">
      <label for="plan" style="display: block; margin-bottom: 5px;">Plan</label>
      <textarea id="plan" rows="3" style="width: 100%; padding: 8px; box-sizing: border-box;"></textarea>
    </div>
    <div class="form-group">
      <label for="context" style="display: block; margin-bottom: 5px;">Context (one per line)</label>
      <textarea id="context" rows="3" style="width: 100%; padding: 8px; box-sizing: border-box;"></textarea>
    </div>
    <div class="form-group">
      <label for="acceptance" style="display: block; margin-bottom: 5px;">Acceptance Criteria (one per line)</label>
      <textarea id="acceptance" rows="3" style="width: 100%; padding: 8px; box-sizing: border-box;"></textarea>
    </div>
    <div class="form-group">
      <label for="dependencies" style="display: block; margin-bottom: 5px;">Dependencies (one per line)</label>
      <textarea id="dependencies" rows="3" style="width: 100%; padding: 8px; box-sizing: border-box;"></textarea>
    </div>
    <div class="form-group">
      <label for="rejection" style="display: block; margin-bottom: 5px;">Rejection Reason</label>
      <textarea id="rejection" rows="3" style="width: 100%; padding: 8px; box-sizing: border-box;"></textarea>
    </div>
    <div class="button-container" style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
      <button type="button" id="cancel-button" style="padding: 10px 20px;">Cancel</button>
      <button type="submit" style="padding: 10px 20px; background-color: #007bff; color: white; border: none; border-radius: 4px;">Save Feature</button>
    </div>
  `;

  root.appendChild(form);

  document.getElementById('cancel-button').addEventListener('click', () => {
    window.close();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (typeof window.taskId === 'undefined') {
        alert('Task ID is not available. Cannot save feature.');
        console.error('window.taskId is not set.');
        return;
    }

    const getLines = (id) => document.getElementById(id).value.split('\n').map(s => s.trim()).filter(Boolean);

    const newFeature = {
      id: String(Date.now()), // Simple unique ID
      status: document.getElementById('status').value,
      title: document.getElementById('title').value,
      description: document.getElementById('description').value,
      plan: document.getElementById('plan').value,
      context: getLines('context'),
      acceptance: getLines('acceptance'),
    };
    
    const dependencies = getLines('dependencies');
    if (dependencies.length > 0) {
        newFeature.dependencies = dependencies;
    }

    const rejection = document.getElementById('rejection').value.trim();
    if (rejection) {
        newFeature.rejection = rejection;
    }

    if (!newFeature.title) {
      alert('Title is required.');
      return;
    }

    try {
      await window.tasksIndex.addFeature(window.taskId, newFeature);
      window.close();
    } catch (error) {
      console.error('Failed to add feature:', error);
      alert(`Error adding feature: ${error.message}`);
    }
  });
});
