const STATUSES = new Set(['+', '~', '-', '?', '=']);

function validateTask(task) {
  const errors = [];
  if (!task || typeof task !== 'object') return { valid: false, errors: ['Task must be an object'] };
  if (typeof task.id !== 'number') errors.push('Task must have a numeric id');
  if (typeof task.title !== 'string') errors.push('Task must have a title');
  if (!STATUSES.has(task.status)) errors.push(`Task status must be one of ${[...STATUSES].join(', ')}`);
  if (!Array.isArray(task.features)) errors.push('Task must have a features array');
  else {
    task.features.forEach((f, i) => {
      if (`${task.id}.${i + 1}` !== f.id) {
        errors.push(`Feature #${i+1} has inconsistent id '${f.id}', expected '${task.id}.${i + 1}'`)
      }
    });
  }
  return { valid: errors.length === 0, errors };
}

module.exports = { validateTask, STATUSES };
