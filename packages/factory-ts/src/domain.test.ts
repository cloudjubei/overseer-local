import { describe, it, expect } from 'vitest'
import { TaskDefinitionSchema, ProjectConfigSchema } from './domain'

describe('Schemas: TaskDefinition', () => {
  it('coerces numeric id to string and allows passthrough fields', () => {
    const parsed = TaskDefinitionSchema.parse({ id: 12, title: 'T', extra: { ok: true } })
    expect(parsed.id).toBe('12')
    expect(parsed.title).toBe('T')
    // @ts-expect-error passthrough exists at runtime
    expect(parsed.extra.ok).toBe(true)
  })

  it('rejects missing id', () => {
    // @ts-expect-error runtime validation
    expect(() => TaskDefinitionSchema.parse({ title: 'x' })).toThrow()
  })
})

describe('Schemas: ProjectConfig', () => {
  it('accepts minimal config and task refs in various forms', () => {
    const cfg = ProjectConfigSchema.parse({ id: 'acme', path: 'child/acme', tasks: [1, '2', { id: '3', title: 't' }] })
    expect(cfg.id).toBe('acme')
    expect(cfg.path).toBe('child/acme')
    expect(cfg.tasks).toEqual(['1', '2', '3'])
  })

  it('rejects missing path or id', () => {
    expect(() => ProjectConfigSchema.parse({ id: 'x' })).toThrow()
    expect(() => ProjectConfigSchema.parse({ path: 'p' })).toThrow()
  })
})
