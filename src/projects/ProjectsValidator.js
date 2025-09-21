export function validateProjectSpec(spec) {
  const errors = []
  if (!spec || typeof spec !== 'object')
    return { valid: false, errors: ['ProjectSpec must be an object'] }
  if (typeof spec.id !== 'string' || !spec.id.trim()) errors.push('id must be a non-empty string')
  if (typeof spec.title !== 'string' || !spec.title.trim())
    errors.push('title must be a non-empty string')
  if (typeof spec.description !== 'string') errors.push('description must be a string')
  if (typeof spec.path !== 'string' || !spec.path.trim())
    errors.push('path must be a non-empty string')
  if (typeof spec.repo_url !== 'string') errors.push('repo_url must be a string')
  if (typeof spec.storyIdToDisplayIndex !== 'object')
    errors.push('storyIdToDisplayIndex must be an object')

  if (!Array.isArray(spec.requirements)) errors.push('requirements must be an array')
  else {
    for (let i = 0; i < spec.requirements.length; i++) {
      const r = spec.requirements[i]
      if (!r || typeof r !== 'object') {
        errors.push(`requirements[${i}] must be an object`)
        continue
      }
      if (typeof r.id !== 'number') errors.push(`requirements[${i}].id must be a number`)
      if (!['+', '~', '-', '?', '='].includes(r.status))
        errors.push(`requirements[${i}].status invalid`)
      if (typeof r.description !== 'string')
        errors.push(`requirements[${i}].description must be a string`)
      if (!Array.isArray(r.stories))
        errors.push(`requirements[${i}].stories must be an array of numbers`)
      else if (!r.stories.every((n) => Number.isInteger(n)))
        errors.push(`requirements[${i}].stories contains non-integer`)
    }
  }
  if (spec.metadata && typeof spec.metadata !== 'object') errors.push('Metadata must be an object')

  return { valid: errors.length === 0, errors }
}
