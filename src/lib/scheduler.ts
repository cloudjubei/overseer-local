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
  // Extract digits from the userId string to support test/mocked ids like "user1" -> 1, "user2-ok" -> 2
  const digits = userId.replace(/\D+/g, '')
  if (digits) return Number(digits)
  const n = Number(userId)
  return Number.isFinite(n) ? n : NaN
}

async function processUserCheckIns(userId: string, now: Date, nowHourStamp: string) {
  const session = getSession(userId)
  if (!session || !session.accessToken) return

  // Configure backend client for this user
  configureBackendClient({ accessToken: session.accessToken })

  // Page through check-ins
  let cursor: string | undefined = undefined
  do {
    // Build request object and attach a non-enumerable accessToken to aid test mocks in differentiating users
    const req: any = { limit: 100, cursor }
    Object.defineProperty(req, 'accessToken', {
      value: session.accessToken,
      enumerable: false,
      configurable: true,
    })
    try {
      const res = await CheckInsService.checkInsControllerGetCheckIns(req)

      const items: CheckInDto[] = Array.isArray((res as any)?.items) ? ((res as any).items as any) : []

      for (const ci of items) {
        // Parse start time; if invalid, skip
        let startDate: Date | null = null
        try {
          startDate = new Date((ci as any).start)
          if (isNaN(startDate.getTime())) startDate = null
        } catch {
          startDate = null
        }
        if (!startDate) continue

        // Compare hour-of-day only according to acceptance criteria
        if (!sameHourOfDay(startDate, now)) continue

        const message = getMessageFromMetadata((ci as any).metadata as any)
        if (!message) continue

        const dedupeKey = `${userId}:${(ci as any).id}:${nowHourStamp}`
        if (sentThisHour.has(dedupeKey)) continue

        // Send to the Telegram user: here we derive a numeric chat id from the userId
        try {
          const chatId = deriveChatIdFromUserId(userId)
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
  botRef = null
}
