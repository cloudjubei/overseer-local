import { describe, expect, it } from 'vitest'
import { applyMention, parseMention, rankMentionMatches } from './mention'

describe('parseMention', () => {
  it('returns null when there is no @', () => {
    expect(parseMention('hello world', 11)).toBeNull()
  })

  it('parses a token at the start of the input', () => {
    expect(parseMention('@foo', 4)).toEqual({ token: 'foo', start: 0, end: 4 })
  })

  it('parses a token preceded by whitespace', () => {
    expect(parseMention('hi @bar', 7)).toEqual({ token: 'bar', start: 3, end: 7 })
  })

  it('rejects an @ in the middle of a word (e.g. emails)', () => {
    expect(parseMention('user@host.com', 13)).toBeNull()
  })

  it('rejects when whitespace is between the @ and the cursor', () => {
    expect(parseMention('@foo bar', 8)).toBeNull()
  })

  it('returns an empty token when @ is the previous char', () => {
    expect(parseMention('hi @', 4)).toEqual({ token: '', start: 3, end: 4 })
  })
})

describe('rankMentionMatches', () => {
  const paths = [
    'src/core/contexts/FilesContext.tsx',
    'src/core/contexts/ToolsContext.tsx',
    'src/index.ts',
    'README.md',
  ]

  it('returns the first N when the token is empty', () => {
    expect(rankMentionMatches(paths, '', 2)).toEqual([
      'src/core/contexts/FilesContext.tsx',
      'src/core/contexts/ToolsContext.tsx',
    ])
  })

  it('ranks prefix matches first', () => {
    expect(rankMentionMatches(paths, 'src/index')).toEqual(['src/index.ts'])
  })

  it('matches case-insensitively and infix', () => {
    expect(rankMentionMatches(paths, 'TOOLS')).toEqual(['src/core/contexts/ToolsContext.tsx'])
  })

  it('respects the limit', () => {
    expect(rankMentionMatches(paths, 'src', 1).length).toBe(1)
  })
})

describe('applyMention', () => {
  it('replaces the @token range with @<path> and a trailing space', () => {
    const text = 'see @foo here'
    const parse = parseMention(text, 8)!
    const result = applyMention(text, parse, 'src/index.ts')
    expect(result.text).toBe('see @src/index.ts  here')
    // Cursor lands just after the inserted space, before " here"
    expect(text.slice(parse.end)).toBe(' here')
    expect(result.cursor).toBe('see @src/index.ts '.length)
  })
})
