export type ValidationResult = { valid: boolean; errors: string[] }

export function validateProjectClient(spec: any): ValidationResult {
  const errors: string[] = []
  if (!spec || typeof spec !== 'object') return { valid: false, errors: ['Project must be an object'] }
  if (typeof spec.id !== 'string' || !spec.id.trim()) errors.push('id must be a non-empty string')
  if (typeof spec.title !== 'string' || !spec.title.trim()) errors.push('title must be a non-empty string')
  if (typeof spec.description !== 'string') errors.push('description must be a string')
  if (typeof spec.path !== 'string' || !spec.path.trim()) errors.push('path must be a non-empty string')
  if (typeof spec.repo_url !== 'string') errors.push('repo_url must be a string')
  if (!Array.isArray(spec.requirements)) errors.push('requirements must be an array (can be empty)')
  if (spec.metadata && typeof spec.metadata  !== 'object') errors.push('Metadata must be an object')
  return { valid: errors.length === 0, errors }
}
