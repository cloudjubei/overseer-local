import { beforeEach, describe, expect, it } from 'vitest'
import { isChatUnread, markSeen, readChatsSeen, writeChatsSeen } from './chatsSeen'

describe('chatsSeen', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  describe('readChatsSeen / writeChatsSeen', () => {
    it('returns an empty map when nothing is stored', () => {
      expect(readChatsSeen()).toEqual({})
    })

    it('round-trips a map through localStorage', () => {
      writeChatsSeen({ 'projects/p1': '2026-05-02T10:00:00Z' })
      expect(readChatsSeen()).toEqual({ 'projects/p1': '2026-05-02T10:00:00Z' })
    })

    it('returns an empty map when storage holds garbage', () => {
      window.localStorage.setItem('thefactory.chatsSeen', '{not json')
      expect(readChatsSeen()).toEqual({})
    })

    it('returns an empty map when storage holds a non-object', () => {
      window.localStorage.setItem('thefactory.chatsSeen', '"string"')
      expect(readChatsSeen()).toEqual({})
    })
  })

  describe('markSeen', () => {
    it('returns a new object with the new value', () => {
      const before = { 'projects/p1': '2026-01-01T00:00:00Z' }
      const after = markSeen(before, 'projects/p1', '2026-05-02T10:00:00Z')
      expect(after).toEqual({ 'projects/p1': '2026-05-02T10:00:00Z' })
      expect(after).not.toBe(before)
    })

    it('returns the same reference when value is unchanged', () => {
      const before = { 'projects/p1': '2026-05-02T10:00:00Z' }
      const after = markSeen(before, 'projects/p1', '2026-05-02T10:00:00Z')
      expect(after).toBe(before)
    })
  })

  describe('isChatUnread', () => {
    it('is false when there are no messages', () => {
      expect(isChatUnread({}, 'projects/p1', undefined)).toBe(false)
    })

    it('is true when there are messages and never-seen', () => {
      expect(isChatUnread({}, 'projects/p1', '2026-05-02T10:00:00Z')).toBe(true)
    })

    it('is true when latest message is newer than seen', () => {
      const map = { 'projects/p1': '2026-05-02T09:00:00Z' }
      expect(isChatUnread(map, 'projects/p1', '2026-05-02T10:00:00Z')).toBe(true)
    })

    it('is false when seen timestamp matches or exceeds latest message', () => {
      const map = { 'projects/p1': '2026-05-02T10:00:00Z' }
      expect(isChatUnread(map, 'projects/p1', '2026-05-02T10:00:00Z')).toBe(false)
      expect(isChatUnread(map, 'projects/p1', '2026-05-02T09:00:00Z')).toBe(false)
    })
  })
})
