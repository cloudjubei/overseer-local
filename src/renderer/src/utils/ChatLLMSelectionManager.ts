import { getChatContextPath } from 'thefactory-tools/utils'
import type { ChatContext } from 'thefactory-tools'

// Manages per-chat LLM selection and recents in localStorage
// Keys are namespaced by chat context path so each chat has its own selection and recents.
class ChatLLMSelectionManager {
  private static selKeyPrefix = 'chatLLM:selected:'
  private static recKeyPrefix = 'chatLLM:recent:'

  static getChatKey(context: ChatContext): string {
    return getChatContextPath(context)
  }

  static getSelectedId(chatKey: string): string | null {
    try {
      return localStorage.getItem(this.selKeyPrefix + chatKey)
    } catch {
      return null
    }
  }

  static setSelectedId(chatKey: string, id: string): void {
    try {
      localStorage.setItem(this.selKeyPrefix + chatKey, id)
    } catch {}
    this.bumpRecent(chatKey, id)
  }

  static getRecentIds(chatKey: string): string[] {
    try {
      const raw = localStorage.getItem(this.recKeyPrefix + chatKey)
      const arr = raw ? JSON.parse(raw) : []
      if (!Array.isArray(arr)) return []
      return arr.filter((x) => typeof x === 'string')
    } catch {
      return []
    }
  }

  private static saveRecentIds(chatKey: string, ids: string[]): void {
    try {
      localStorage.setItem(this.recKeyPrefix + chatKey, JSON.stringify(ids))
    } catch {}
  }

  static bumpRecent(chatKey: string, id: string): void {
    try {
      const ids = this.getRecentIds(chatKey)
      const next = [id, ...ids.filter((x) => x !== id)]
      this.saveRecentIds(chatKey, next.slice(0, 10))
    } catch {}
  }

  static clearInvalid(chatKey: string, validIds: Set<string>): void {
    const current = this.getRecentIds(chatKey)
    const cleaned = current.filter((x) => validIds.has(x))
    this.saveRecentIds(chatKey, cleaned)
    const selected = this.getSelectedId(chatKey)
    if (selected && !validIds.has(selected)) {
      try { localStorage.removeItem(this.selKeyPrefix + chatKey) } catch {}
    }
  }
}

export default ChatLLMSelectionManager
