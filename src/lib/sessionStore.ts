import fs from 'fs'
import path from 'path'
import { logger } from './logger'

export interface ConversationState {
  lastAction: string

  responses?: number[]
  responsesMessageId?: number

  // Identifier for the active conversation flow (as provided by backend)
  flowId: string
  // Arbitrary context/state needed to resume the conversation as directed by backend
  // Keep it open/typed as unknown values; backend controls structure
  context?: Record<string, any>
  // Optional timestamp (epoch seconds) to help with expirations/cleanup if needed
  lastUpdatedAt?: number
}

export interface SessionData {
  userId: string // Telegram user id as string
  accessToken: string
  idToken?: string
  refreshToken?: string
  expiresAt?: number // epoch seconds
  // Holds current backend-driven conversation state. Undefined or null when no active flow.
  conversationState?: ConversationState | null
}

function getDataDir(): string {
  // Allow override for testing via env var
  const base = process.env.SESSIONS_DIR || '.sessions'
  return path.resolve(base)
}

function getSessionsFile(): string {
  return path.join(getDataDir(), '.sessions.json')
}

function ensureDataDir() {
  const dir = getDataDir()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function readAll(): Record<string, SessionData> {
  try {
    ensureDataDir()
    const file = getSessionsFile()
    if (!fs.existsSync(file)) return {}
    const raw = fs.readFileSync(file, 'utf8')
    if (!raw.trim()) return {}
    const data = JSON.parse(raw)
    // Backward compatibility: previously stored records won't have conversationState
    return data && typeof data === 'object' ? (data as Record<string, SessionData>) : {}
  } catch (e) {
    logger.warn('sessionStore: failed to read sessions file, starting empty', e)
    return {}
  }
}

function writeAll(sessions: Record<string, SessionData>) {
  try {
    ensureDataDir()
    const file = getSessionsFile()
    const tmp = file + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(sessions, null, 2), 'utf8')
    fs.renameSync(tmp, file)
  } catch (e) {
    logger.error('sessionStore: failed to write sessions file', e)
  }
}

export function getSession(userId: string): SessionData | undefined {
  const all = readAll()
  return all[userId]
}

export function setSession(session: SessionData) {
  const all = readAll()
  // Preserve existing conversationState if not explicitly provided
  const prev = all[session.userId]
  const merged: SessionData = {
    ...prev,
    ...session,
    conversationState:
      session.conversationState !== undefined
        ? session.conversationState
        : (prev?.conversationState ?? undefined),
  }
  all[session.userId] = merged
  writeAll(all)
}

export function clearSession(userId: string) {
  const all = readAll()
  if (all[userId]) {
    delete all[userId]
    writeAll(all)
  }
}

export function clearConversationSession(userId: string, prev?: SessionData) {
  const p = prev ?? getSession(userId) ?? { userId }
  setSession({
    ...p,
    conversationState: null,
    accessToken: prev?.accessToken || '',
    idToken: prev?.idToken,
    refreshToken: prev?.refreshToken,
    expiresAt: prev?.expiresAt,
  })
}

export function isAuthenticated(userId: string): boolean {
  const s = getSession(userId)
  if (!s || !s.accessToken) return false
  if (s.expiresAt && Number.isFinite(s.expiresAt)) {
    const now = Math.floor(Date.now() / 1000)
    return now < s.expiresAt - 30 // small skew
  }
  return true
}

// Returns all known Telegram user ids that have ever established a session (authenticated at least once)
export function getAllUserIds(): string[] {
  const all = readAll()
  return Object.keys(all)
}
