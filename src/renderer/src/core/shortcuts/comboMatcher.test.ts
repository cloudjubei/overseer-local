import { describe, expect, it } from 'vitest'
import { comboMatches, prettyCombo } from './comboMatcher'

const ev = (over: Partial<KeyboardEvent>): KeyboardEvent =>
  ({
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    key: '',
    ...over,
  }) as KeyboardEvent

describe('comboMatches', () => {
  it('matches Mod+K with meta on darwin', () => {
    expect(comboMatches('Mod+K', ev({ metaKey: true, key: 'k' }), 'meta')).toBe(true)
  })

  it('matches Mod+K with ctrl on linux', () => {
    expect(comboMatches('Mod+K', ev({ ctrlKey: true, key: 'K' }), 'ctrl')).toBe(true)
  })

  it('rejects when modifier missing', () => {
    expect(comboMatches('Mod+K', ev({ key: 'k' }), 'meta')).toBe(false)
  })

  it('rejects extra modifier requirements not satisfied', () => {
    expect(comboMatches('Mod+Shift+F', ev({ metaKey: true, key: 'f' }), 'meta')).toBe(false)
    expect(
      comboMatches('Mod+Shift+F', ev({ metaKey: true, shiftKey: true, key: 'f' }), 'meta'),
    ).toBe(true)
  })

  it('matches single-key combos like /', () => {
    expect(comboMatches('Mod+/', ev({ metaKey: true, key: '/' }), 'meta')).toBe(true)
  })

  it('case-insensitive for single-letter base', () => {
    expect(comboMatches('Mod+N', ev({ metaKey: true, key: 'n' }), 'meta')).toBe(true)
    expect(comboMatches('Mod+N', ev({ metaKey: true, key: 'N' }), 'meta')).toBe(true)
  })
})

describe('prettyCombo', () => {
  it('renders ⌘ on meta preference', () => {
    expect(prettyCombo('Mod+K', 'meta')).toBe('⌘+K')
    expect(prettyCombo('Mod+Shift+F', 'meta')).toBe('⌘+Shift+F')
  })

  it('renders Ctrl on ctrl preference', () => {
    expect(prettyCombo('Mod+K', 'ctrl')).toBe('Ctrl+K')
  })

  it('renders empty for empty input', () => {
    expect(prettyCombo('', 'meta')).toBe('')
  })
})
