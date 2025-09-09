export const STATUSES = new Set(['+', '~', '-', '?', '=']);

export function validateTask(task) {
  const errors = [];
  if (!task || typeof task !== 'object') return { valid: false, errors: ['Task must be an object'] };
  if (typeof task.id !== 'string') errors.push('Task must have a string id');
  if (typeof task.title !== 'string') errors.push('Task must have a title');
  if (!STATUSES.has(task.status)) errors.push(`Task status must be one of ${[...STATUSES].join(', ')}`);
  if (!Array.isArray(task.features)) errors.push('Task must have a features array');
  return { valid: errors.length === 0, errors };
}
