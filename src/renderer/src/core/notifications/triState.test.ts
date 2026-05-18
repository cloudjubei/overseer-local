import { describe, expect, it } from 'vitest'
import { resolveTriState } from './triState'

describe('resolveTriState', () => {
  it('falls back to the global value when override is undefined', () => {
    expect(resolveTriState(true, undefined)).toBe(true)
    expect(resolveTriState(false, undefined)).toBe(false)
  })

  it('forces on when override is true, regardless of global', () => {
    expect(resolveTriState(false, true)).toBe(true)
    expect(resolveTriState(true, true)).toBe(true)
  })

  it('forces off when override is false, regardless of global', () => {
    expect(resolveTriState(true, false)).toBe(false)
    expect(resolveTriState(false, false)).toBe(false)
  })
})
