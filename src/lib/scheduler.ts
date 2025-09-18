import TelegramBot from 'node-telegram-bot-api'
import cron, { ScheduledTask } from 'node-cron'
import { config } from '../config/env'

const tasks: ScheduledTask[] = []

export function initScheduler(bot: TelegramBot) {
  // Run at the beginning of every hour (e.g., 09:00, 10:00, 11:00), using configured timezone
  const tz = config.timezone || 'UTC'

  const hourly = cron.schedule(
    '0 * * * *',
    async () => {
      // Placeholder: core job logic cleared out to prepare for check-in functionality
      // Future implementation will fetch user check-ins from backend and send messages when appropriate.
      try {
        // no-op for now
      } catch (err) {
        console.warn('Hourly scheduler tick error:', (err as any)?.message || err)
      }
    },
    { timezone: tz },
  )

  tasks.push(hourly)
  hourly.start()

  console.log(`Scheduler initialized. Running hourly at the start of the hour (${tz}).`)
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
