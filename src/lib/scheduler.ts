import cron from 'node-cron'
import TelegramBot from 'node-telegram-bot-api'
import { config } from '../config/env'
import { getAllUserIds, getSession } from './sessionStore'
import { configureBackendClient } from './backendClient'
import { CheckInModel, CheckInsService } from '../generated/backend'
import { logger } from './logger'
import actionMicroGoalsGenerate from '../actions/actionMicroGoalsGenerate'
import actionMicroGoalsCheck from '../actions/actionMicroGoalsCheck'
import actionWeeklyReset from '../actions/actionWeeklyReset'

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

        const dedupeKey = `${userId}:${ci.id}:${nowHourStamp}`
        if (sentThisHour.has(dedupeKey)) continue

        const metadata = ci.metadata as any
        const action = metadata?.action
        const message = getMessageFromMetadata(metadata)
        const chatId = getChatIdFromMetadata(metadata)

        if (!action && !message) continue

        if (typeof chatId !== 'number' || !Number.isFinite(chatId)) {
          logger.warn(`Skipping check-in ${ci.id} for user ${userId}: unable to determine chatId`)
          continue
        }

        if (!botRef) {
          logger.warn('Scheduler bot reference is not initialized; cannot process check-in.')
          continue
        }

        try {
          if (action) {
            const chat = { id: chatId, type: 'private' } as TelegramBot.Chat
            const from = {
              id: parseInt(userId, 10),
              is_bot: false,
              first_name: 'User',
            } as TelegramBot.User
            const fakeMsg = {
              message_id: 0, // Not used by actions
              date: Math.floor(Date.now() / 1000),
              chat,
              from,
            } as TelegramBot.Message

            // Small visual dividers before key stages
            if (action === 'micro_goals_generate') {
              await botRef.sendMessage(chatId, '☀️ Morning wake-up')
            } else if (action === 'micro_goals_check') {
              await botRef.sendMessage(chatId, '✨ Evening reflection')
            }

            switch (action) {
              case 'micro_goals_generate':
                await actionMicroGoalsGenerate(botRef, chat, from, '', fakeMsg, false)
                break
              case 'micro_goals_check':
                await actionMicroGoalsCheck(botRef, chat, from, '', fakeMsg)
                break
              case 'weekly_reset':
                await actionWeeklyReset(botRef, chatId, from)
                break
              default:
                logger.warn(`Unknown check-in action '${action}' for user ${userId}`)
                if (message) {
                  await botRef.sendMessage(chatId, message, { parse_mode: 'HTML' })
                }
                break
            }
          } else if (message) {
            // Fallback for check-ins without an action
            await botRef.sendMessage(chatId, message, { parse_mode: 'HTML' })
          }

          sentThisHour.add(dedupeKey)
        } catch (err) {
          logger.error(`Failed to process check-in ${ci.id} for user ${userId}`, err)
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
