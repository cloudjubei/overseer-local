import cron from 'node-cron'
import TelegramBot from 'node-telegram-bot-api'
import { config } from '../config/env'
import { getAllUserIds, getSession } from './sessionStore'
import { configureBackendClient } from './backendClient'
import { CheckInModel, CheckInsService } from '../generated/backend'
import { logger } from './logger'
import actionMicroGoalsGenerate from '../actions/actionMicroGoalsGenerate'
import actionMicroGoalsCheck from '../actions/actionMicroGoalsCheck'

let scheduledTask: cron.ScheduledTask | null = null
let botRef: TelegramBot | null = null

// Track notifications sent within the current hour window to avoid duplicates if the task runs more than once
// Key format: `${userId}:${checkInId}:${yyyyMMddHH}`
const sentThisHour = new Set<string>()

export function currentHourStamp(date = new Date()): string {
  // Format YYYYMMDDHH using UTC to keep deterministic formatting in tests and across environments
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  const h = String(date.getUTCHours()).padStart(2, '0')
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

function needsTelegramChatMetadata(
  metadata: Record<string, any> | undefined,
  chatId: number,
  userId: string,
): boolean {
  // If there is already a top-level numeric chatId, we consider metadata sufficient and do not update.
  // This matches the expectation that we shouldn't rewrite metadata when chatId is already present as number.
  const topLevelChatId = (metadata as any)?.chatId
  if (typeof topLevelChatId === 'number' && Number.isFinite(topLevelChatId)) return false

  // Otherwise, we update if either the resolved chatId differs or telegram.userId is missing.
  const existing = getChatIdFromMetadata(metadata)
  if (existing !== chatId) return true
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

async function ensureTelegramMetadata(ci: CheckInModel, chatId: number, userId: string) {
  try {
    if (!needsTelegramChatMetadata(ci.metadata as any, chatId, userId)) return
    const newMeta = mergeTelegramChatMetadata(ci.metadata as any, chatId, userId)
    await CheckInsService.checkInsControllerUpdateCheckIn({
      id: ci.id,
      requestBody: { metadata: newMeta },
    })
  } catch (err) {
    // Non-fatal; continue sending
    logger.warn(`Failed to update check-in metadata for ${ci.id}`, err)
  }
}

function isMorningCheckInMessage(message: string): boolean {
  return /\bmorning\b/i.test(message)
}

function isEveningCheckInMessage(message: string): boolean {
  return /\bevening\b/i.test(message)
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
      const res = await CheckInsService.checkInsControllerGetCheckIns(req)
      const items: CheckInModel[] = res.items

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
        if (startDate.getTime() > now.getTime()) continue
        if (!sameHourOfDay(startDate, now)) continue

        const message = getMessageFromMetadata(ci.metadata as any)
        if (!message) continue

        const dedupeKey = `${userId}:${ci.id}:${nowHourStamp}`
        if (sentThisHour.has(dedupeKey)) continue

        // Determine chatId strictly from metadata. If not present, skip.
        const chatId = getChatIdFromMetadata(ci.metadata as any)
        if (typeof chatId !== 'number' || !Number.isFinite(chatId)) {
          logger.warn(`Skipping check-in ${ci.id} for user ${userId}: unable to determine chatId`)
          continue
        }

        // Best-effort: persist telegram chat metadata so backend holds routing context
        ensureTelegramMetadata(ci, chatId, userId).catch(() => {})

        // If this is a morning check-in created by actionMacroGoal, trigger micro-goal generation instead of sending a plain message
        if (isMorningCheckInMessage(message)) {
          try {
            if (!botRef) {
              logger.warn('Scheduler bot reference is not initialized; cannot trigger micro-goal generation')
            } else {
              // Construct minimal chat/user/message objects; the action doesn't rely on their fields currently
              const chat = { id: chatId, type: 'private' } as TelegramBot.Chat
              const from = { id: chatId, is_bot: false, first_name: 'User' } as unknown as TelegramBot.User
              const fakeMsg = {
                message_id: 0,
                date: Math.floor(Date.now() / 1000),
                chat: chat as any,
                from: from as any,
              } as unknown as TelegramBot.Message

              await actionMicroGoalsGenerate(botRef, chat, from, '', fakeMsg)
            }
            sentThisHour.add(dedupeKey)
          } catch (err) {
            logger.error(`Failed to trigger micro-goals generation for user ${userId}`, err)
          }
          continue
        }

        // If this is an evening check-in created by actionMacroGoal, trigger micro-goals check flow
        if (isEveningCheckInMessage(message)) {
          try {
            if (!botRef) {
              logger.warn('Scheduler bot reference is not initialized; cannot trigger micro-goal check')
            } else {
              const chat = { id: chatId, type: 'private' } as TelegramBot.Chat
              const from = { id: chatId, is_bot: false, first_name: 'User' } as unknown as TelegramBot.User
              const fakeMsg = {
                message_id: 0,
                date: Math.floor(Date.now() / 1000),
                chat: chat as any,
                from: from as any,
              } as unknown as TelegramBot.Message

              await actionMicroGoalsCheck(botRef, chat, from, '', fakeMsg)
            }
            sentThisHour.add(dedupeKey)
          } catch (err) {
            logger.error(`Failed to trigger micro-goals check for user ${userId}`, err)
          }
          continue
        }

        // Default behavior: send the check-in message to the Telegram user
        try {
          await botRef?.sendMessage(chatId, message)
          sentThisHour.add(dedupeKey)
        } catch (err) {
          logger.error(`Failed to send check-in message to user ${userId}`, err)
        }
      }

      cursor = (res as any)?.cursor || undefined
      if (!cursor) break
    } catch (err) {
      logger.error(`Scheduler: failed to fetch check-ins for user ${userId}`, err)
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
    logger.error('Scheduler top-level error:', e)
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
