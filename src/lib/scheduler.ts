import cron from 'node-cron'
import TelegramBot from 'node-telegram-bot-api'
import { config } from '../config/env'
import { getAllUserIds, getSession } from './sessionStore'
import { configureBackendClient } from './backendClient'
import { CheckInsService, CheckInDto } from '../generated/backend'

let scheduledTask: cron.ScheduledTask | null = null
let botRef: TelegramBot | null = null

// Track notifications sent within the current hour window to avoid duplicates if the task runs more than once
// Key format: `${userId}:${checkInId}:${yyyyMMddHH}`
const sentThisHour = new Set<string>()

export function currentHourStamp(date = new Date()): string {
  // Format YYYYMMDDHH in the runtime timezone (process TZ can be set via env; node-cron also uses config.timezone)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  return `${y}${m}${d}${h}`
}

export function sameHourOfDay(d1: Date, d2: Date): boolean {
  return d1.getHours() === d2.getHours()
}

export function getMessageFromMetadata(
  metadata: Record<string, any> | undefined,
): string | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined
  // Common keys we might support
  const candidates = ['message', 'text', 'content', 'msg']
  for (const k of candidates) {
    const v = (metadata as any)[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return undefined
}

function deriveChatIdFromUserId(userId: string): number {
  const digits = userId.replace(/\D+/g, '')
  if (digits) return Number(digits)
  const n = Number(userId)
  return Number.isFinite(n) ? n : NaN
}

function getChatIdFromMetadata(metadata?: Record<string, any>): number | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined
  // Support a few shapes:
  // - metadata.chatId
  // - metadata.chat_id
  // - metadata.telegram.chatId
  // - metadata.telegram.chat.id
  const direct = (metadata as any).chatId ?? (metadata as any).chat_id
  if (typeof direct === 'number' && Number.isFinite(direct)) return direct
  if (typeof direct === 'string' && direct.trim() && Number.isFinite(Number(direct))) {
    return Number(direct)
  }
  const tg = (metadata as any).telegram
  if (tg && typeof tg === 'object') {
    const tgChatId = (tg as any).chatId ?? (tg as any)?.chat?.id
    if (typeof tgChatId === 'number' && Number.isFinite(tgChatId)) return tgChatId
    if (typeof tgChatId === 'string' && tgChatId.trim() && Number.isFinite(Number(tgChatId))) {
      return Number(tgChatId)
    }
  }
  return undefined
}

function needsTelegramChatMetadata(metadata: Record<string, any> | undefined, chatId: number, userId: string): boolean {
  const existing = getChatIdFromMetadata(metadata)
  if (existing !== chatId) return true
  // also check presence of telegram.userId for completeness
  const hasUserId = !!(metadata as any)?.telegram?.userId
  return !hasUserId
}

function mergeTelegramChatMetadata(
  metadata: Record<string, any> | undefined,
  chatId: number,
  userId: string,
): Record<string, any> {
  const base: Record<string, any> = metadata && typeof metadata === 'object' ? { ...metadata } : {}
  const telegram = { ...(base.telegram || {}) }
  // Prefer a normalized structure
  telegram.chatId = chatId
  telegram.userId = userId
  // also reflect at top-level for broader compatibility if consumers expect it
  base.chatId = chatId
  base.telegram = telegram
  return base
}

async function ensureTelegramMetadata(ci: CheckInDto, chatId: number, userId: string) {
  try {
    if (!needsTelegramChatMetadata(ci.metadata, chatId, userId)) return
    const newMeta = mergeTelegramChatMetadata(ci.metadata, chatId, userId)
    await CheckInsService.checkInsControllerUpdateCheckIn({
      id: ci.id,
      requestBody: { metadata: newMeta },
    })
  } catch (err) {
    // Non-fatal; continue sending
    console.warn(`Failed to update check-in metadata for ${ci.id}`, err)
  }
}

async function processUserCheckIns(userId: string, now: Date, nowHourStamp: string) {
  const session = getSession(userId)
  if (!session || !session.accessToken) return

  // Configure backend client for this user
  configureBackendClient({ accessToken: session.accessToken })

  // Page through check-ins
  let cursor: string | undefined = undefined
  do {
    // Build request object
    const req = { limit: 100, cursor }
    try {
      const res = await CheckInsService.checkInsControllerGetCheckIns(req as any)
      const items: CheckInDto[] = res.items

      for (const ci of items) {
        // Parse start time; if invalid, skip
        let startDate: Date | null = null
        try {
          startDate = new Date(ci.start)
          if (isNaN(startDate.getTime())) startDate = null
        } catch {
          startDate = null
        }
        if (!startDate) continue
        if (!sameHourOfDay(startDate, now)) continue

        const message = getMessageFromMetadata(ci.metadata)
        if (!message) continue

        const dedupeKey = `${userId}:${ci.id}:${nowHourStamp}`
        if (sentThisHour.has(dedupeKey)) continue

        // Determine chatId from metadata (preferred), fall back to deriving from userId
        let chatId = getChatIdFromMetadata(ci.metadata)
        if (typeof chatId !== 'number' || !Number.isFinite(chatId)) {
          chatId = deriveChatIdFromUserId(userId)
        }
        if (typeof chatId !== 'number' || !Number.isFinite(chatId)) {
          console.warn(`Skipping check-in ${ci.id} for user ${userId}: unable to determine chatId`)
          continue
        }

        // Best-effort: persist telegram chat metadata so backend holds routing context
        ensureTelegramMetadata(ci, chatId, userId).catch(() => {})

        // Send to the Telegram user
        try {
          await botRef?.sendMessage(chatId, message)
          sentThisHour.add(dedupeKey)
        } catch (err) {
          console.error(`Failed to send check-in message to user ${userId}`, err)
        }
      }

      cursor = (res as any)?.cursor || undefined
      if (!cursor) break
    } catch (err) {
      console.error(`Scheduler: failed to fetch check-ins for user ${userId}`, err)
      break // stop paging on error for this user
    }
  } while (cursor)
}

export async function tickSchedulerOnce(now = new Date()) {
  const nowStamp = currentHourStamp(now)
  // Reset dedupe set when hour changes (simple pruning)
  for (const key of Array.from(sentThisHour)) {
    if (!key.endsWith(nowStamp)) sentThisHour.delete(key)
  }
  try {
    const userIds = getAllUserIds()
    for (const userId of userIds) {
      await processUserCheckIns(userId, now, nowStamp)
    }
  } catch (e) {
    console.error('Scheduler top-level error:', e)
  }
}

export function initScheduler(bot: TelegramBot) {
  if (scheduledTask) return
  botRef = bot

  const run = async () => {
    await tickSchedulerOnce(new Date())
  }

  // Run at the start of every hour
  scheduledTask = cron.schedule('0 * * * *', run, {
    timezone: config.timezone || 'UTC',
  })

  scheduledTask.start()
}

export function shutdownScheduler() {
  if (scheduledTask) {
    scheduledTask.stop()
    scheduledTask = null
  }
  sentThisHour.clear()
  botRef = null
}
