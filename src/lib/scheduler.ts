import TelegramBot from 'node-telegram-bot-api'
import cron, { ScheduledTask } from 'node-cron'
import { config } from '../config/env'
import { getAllUserIds, isAuthenticated } from './sessionStore'

const tasks: ScheduledTask[] = []

function toChatId(userId: string): number | undefined {
  const n = Number(userId)
  return Number.isFinite(n) ? n : undefined
}

async function broadcastHello(bot: TelegramBot, label: 'morning' | 'evening') {
  const userIds = getAllUserIds()
  if (!userIds.length) return

  const authenticated = userIds.filter((u) => isAuthenticated(u))
  if (!authenticated.length) return

  const maxConcurrency = 10
  let active = 0
  let index = 0
  let resolved = 0

  await new Promise<void>((resolve) => {
    const next = () => {
      if (resolved >= authenticated.length) return resolve()
      while (active < maxConcurrency && index < authenticated.length) {
        const userId = authenticated[index++]
        const chatId = toChatId(userId)
        if (!chatId) {
          resolved++
          continue
        }
        active++
        bot
          .sendMessage(chatId, 'hello')
          .catch((err) => {
            // Non-fatal; user may have blocked the bot or chat is unavailable
            console.warn(
              `scheduler: failed to send to ${chatId} (${label})`,
              err?.response?.body || err?.message || err,
            )
          })
          .finally(() => {
            active--
            resolved++
            next()
          })
      }
    }
    next()
  })
}

export function initScheduler(bot: TelegramBot) {
  // Morning at 09:00 and evening at 19:00, using configured timezone
  const tz = config.timezone || 'UTC'

  const morning = cron.schedule('0 9 * * *', () => broadcastHello(bot, 'morning'), { timezone: tz })
  const evening = cron.schedule('0 19 * * *', () => broadcastHello(bot, 'evening'), {
    timezone: tz,
  })

  tasks.push(morning, evening)

  // Start tasks immediately
  morning.start()
  evening.start()

  console.log(`Scheduler initialized. Daily check-ins at 09:00 and 19:00 (${tz}).`)
}

export function shutdownScheduler() {
  for (const t of tasks) {
    try {
      t.stop()
      // eslint-disable-next-line no-empty
    } catch {}
  }
  tasks.length = 0
  console.log('Scheduler stopped.')
}
