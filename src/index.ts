import TelegramBot from 'node-telegram-bot-api'
import { config } from './config/env'
import {
  handleAuthMessage,
  getTelegramUserId,
  logoutUser,
  ensureAccessTokenForUser,
  ensureBackendConfigured,
} from './lib/auth'
import {
  startProfileFlow,
  handleProfileFlowMessage,
  isInProfileFlow,
  cancelProfileFlow,
} from './flows/profile'
import {
  startNewGoalFlow,
  handleNewGoalFlowMessage,
  isInNewGoalFlow,
  cancelNewGoalFlow,
  handleNewGoalCallback,
} from './flows/newGoal'
import { initScheduler, shutdownScheduler } from './lib/scheduler'
import { GoalsService } from './generated/backend'

// Basic command handler types
export type CommandHandler = (ctx: {
  bot: TelegramBot
  msg: TelegramBot.Message
  args: string[]
}) => Promise<void> | void

class CommandRegistry {
  private commands: Map<string, { handler: CommandHandler; description?: string }> = new Map()

  register(command: string, handler: CommandHandler, description?: string) {
    const key = command.replace(/^\//, '').toLowerCase()
    this.commands.set(key, { handler, description })
  }

  get(command: string) {
    return this.commands.get(command.toLowerCase())
  }

  listForBotCommands(): Array<{ command: string; description: string }> {
    const list: Array<{ command: string; description: string }> = []
    for (const [command, { description }] of this.commands.entries()) {
      if (description) list.push({ command, description })
    }
    return list
  }
}

async function main() {
  const token = config.telegramBotToken

  const bot = new TelegramBot(token, { polling: true })
  const commands = new CommandRegistry()

  // Register base commands
  commands.register(
    'start',
    async ({ bot, msg }) => {
      const chatId = msg.chat.id
      const name = msg.from?.first_name || 'there'
      const welcome = [
        `Hi ${name}! Welcome to Compass.`,
        "I'm your assistant to help manage your goals.",
        '',
        'If this is your first time, please provide your access code when prompted.',
      ].join('\n')

      await bot.sendMessage(chatId, welcome, { parse_mode: 'HTML' })
      // Auth prompting is handled globally in the message listener before commands.
    },
    'Start interacting with the bot',
  )

  commands.register(
    'logout',
    async ({ bot, msg }) => {
      const chatId = msg.chat.id
      const userId = getTelegramUserId(msg)
      if (!userId) {
        await bot.sendMessage(chatId, 'Unable to determine your Telegram user id.')
        return
      }
      logoutUser(userId)
      await bot.sendMessage(
        chatId,
        'You have been logged out. Send any message to authenticate again.',
      )
    },
    'Log out and clear your session',
  )

  // Profile update flow command
  commands.register(
    'profile',
    async ({ bot, msg }) => {
      const chatId = msg.chat.id
      const userId = getTelegramUserId(msg)
      if (!userId) {
        await bot.sendMessage(chatId, 'Unable to determine your Telegram user id.')
        return
      }
      await startProfileFlow(bot, userId, chatId)
    },
    'Update your profile (DOB, gender, weight, height)',
  )

  // New goal creation flow
  commands.register(
    'newgoal',
    async ({ bot, msg }) => {
      const chatId = msg.chat.id
      const userId = getTelegramUserId(msg)
      if (!userId) {
        await bot.sendMessage(chatId, 'Unable to determine your Telegram user id.')
        return
      }
      await startNewGoalFlow(bot, userId, chatId)
    },
    'Create a new goal from free text (with AI suggestions)',
  )

  // Micro goals listing command
  commands.register(
    'microgoals',
    async ({ bot, msg }) => {
      const chatId = msg.chat.id
      const userId = getTelegramUserId(msg)
      if (!userId) {
        await bot.sendMessage(chatId, 'Unable to determine your Telegram user id.')
        return
      }

      try {
        await bot.sendChatAction(chatId, 'typing')
        // Fetch goals (first page, default limit per backend schema)
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const res = await GoalsService.goalsControllerList({})
        const items = Array.isArray(res?.items) ? res.items : []
        const micro = items.filter((g: any) => g?.type === 'MICRO')

        if (!micro.length) {
          await bot.sendMessage(chatId, 'You have no micro goals yet.')
          return
        }

        const lines: string[] = []
        lines.push(`You have ${micro.length} micro goal${micro.length === 1 ? '' : 's'}:`)
        for (const g of micro) {
          const status = g.completedAt ? '✅' : '•'
          const category = typeof g.category === 'string' ? g.category : 'UNKNOWN'
          const difficulty = typeof g.difficulty === 'string' ? g.difficulty : 'UNKNOWN'
          const text = typeof g.text === 'string' ? g.text : ''
          lines.push(`${status} [${category}/${difficulty}] ${text}`)
        }

        await bot.sendMessage(chatId, lines.join('\n'))
      } catch (err: any) {
        console.error('Failed to fetch micro goals', err?.response?.data || err?.message || err)
        await bot.sendMessage(
          chatId,
          'Sorry, I could not retrieve your micro goals right now. Please try again later.',
        )
      }
    },
    'View your current micro goals',
  )

  // Macro goals listing command
  commands.register(
    'macrogoals',
    async ({ bot, msg }) => {
      const chatId = msg.chat.id
      const userId = getTelegramUserId(msg)
      if (!userId) {
        await bot.sendMessage(chatId, 'Unable to determine your Telegram user id.')
        return
      }

      try {
        await bot.sendChatAction(chatId, 'typing')
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const res = await GoalsService.goalsControllerList({})
        const items = Array.isArray(res?.items) ? res.items : []
        const macro = items.filter((g: any) => g?.type === 'MACRO')

        if (!macro.length) {
          await bot.sendMessage(chatId, 'You have no macro goals yet.')
          return
        }

        const lines: string[] = []
        lines.push(`You have ${macro.length} macro goal${macro.length === 1 ? '' : 's'}:`)
        for (const g of macro) {
          const status = g.completedAt ? '✅' : '•'
          const category = typeof g.category === 'string' ? g.category : 'UNKNOWN'
          const difficulty = typeof g.difficulty === 'string' ? g.difficulty : 'UNKNOWN'
          const text = typeof g.text === 'string' ? g.text : ''
          lines.push(`${status} [${category}/${difficulty}] ${text}`)
        }

        await bot.sendMessage(chatId, lines.join('\n'))
      } catch (err: any) {
        console.error('Failed to fetch macro goals', err?.response?.data || err?.message || err)
        await bot.sendMessage(
          chatId,
          'Sorry, I could not retrieve your macro goals right now. Please try again later.',
        )
      }
    },
    'View your current macro goals',
  )

  // Optional: expose /cancel to cancel active flows
  commands.register(
    'cancel',
    async ({ bot, msg }) => {
      const userId = getTelegramUserId(msg)
      if (!userId) return
      if (isInProfileFlow(userId)) {
        await cancelProfileFlow(bot, userId)
      } else if (isInNewGoalFlow(userId)) {
        await cancelNewGoalFlow(bot, userId)
      } else {
        await bot.sendMessage(msg.chat.id, 'Nothing to cancel.')
      }
    },
    'Cancel the current action',
  )

  // Sync bot command list (as shown in Telegram UI)
  try {
    const botCommands = commands.listForBotCommands()
    if (botCommands.length > 0) {
      await bot.setMyCommands(botCommands)
    }
  } catch (err) {
    // Non-fatal
    console.warn('Failed to set bot commands:', err)
  }

  // Initialize scheduler for daily check-ins
  initScheduler(bot)

  // Global message listener: ensure authentication flow first
  bot.on('message', async (msg) => {
    try {
      // Run authentication gate. If it handles the message (prompt/login), stop here.
      const handledByAuth = await handleAuthMessage(bot, msg)
      if (handledByAuth) return

      const userId = getTelegramUserId(msg)
      if (!userId) {
        await bot.sendMessage(msg.chat.id, 'Unable to determine your Telegram user id.')
        return
      }

      // If user is currently in a conversation flow, route message to it and stop.
      if (isInProfileFlow(userId)) {
        await handleProfileFlowMessage(bot, userId, msg)
        return
      }
      if (isInNewGoalFlow(userId)) {
        await handleNewGoalFlowMessage(bot, userId, msg)
        return
      }

      const text = msg.text || ''
      if (!text.startsWith('/')) {
        // For now ignore non-commands if authenticated; flows handle their own inputs above.
        return
      }

      // Extract command and args. Support forms like /start and /start@BotName
      const [first, ...rest] = text.trim().split(/\s+/)
      const rawCommand = first.slice(1) // remove leading '/'
      const commandOnly = rawCommand.split('@')[0].toLowerCase()
      const args = rest

      const def = commands.get(commandOnly)
      if (!def) {
        // Optional: basic unknown command feedback
        await bot.sendMessage(msg.chat.id, `Unknown command: /${commandOnly}`)
        return
      }

      await def.handler({ bot, msg, args })
    } catch (err) {
      console.error('Error handling message:', err)
      await bot.sendMessage(
        msg.chat.id,
        'Sorry, something went wrong while processing your message.',
      )
    }
  })

  // Handle inline keyboard callbacks (e.g., goal suggestions selection/refine)
  bot.on('callback_query', async (query) => {
    try {
      // Ensure backend client and token for this user
      await ensureBackendConfigured()
      const userId = query.from?.id ? String(query.from.id) : undefined
      if (!userId) {
        try {
          await bot.answerCallbackQuery(query.id, {
            text: 'Cannot identify user',
            show_alert: false,
          })
        } catch {}
        return
      }
      ensureAccessTokenForUser(userId)

      const handled = await handleNewGoalCallback(bot, userId, query)
      if (!handled) {
        // Not for our flows; ignore silently or add future handlers
      }
    } catch (err) {
      console.error('Error handling callback_query:', err)
      try {
        await bot.answerCallbackQuery(query.id, { text: 'An error occurred', show_alert: false })
      } catch {}
    }
  })

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}. Stopping bot polling...`)
    try {
      await bot.stopPolling()
      shutdownScheduler()
      console.log('Bot polling stopped. Exiting.')
    } catch (err) {
      console.error('Error during shutdown:', err)
    } finally {
      process.exit(0)
    }
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))

  console.log(
    `Compass Telegram Bot started. Environment: ${config.nodeEnv}. Timezone: ${config.timezone}`,
  )
}

main().catch((err) => {
  console.error('Fatal error starting bot:', err)
  process.exit(1)
})
