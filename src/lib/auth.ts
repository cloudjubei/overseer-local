import TelegramBot from 'node-telegram-bot-api'
import { config } from '../config/env'
import { isAuthenticated, getSession, setSession, clearSession } from './sessionStore'
import { configureBackendClient, setAccessToken } from './backendClient'
import { AuthService } from '../generated/backend'
import { logger } from './logger'

const pendingAccessCode = new Set<string>()

export function getTelegramUserId(msg: TelegramBot.Message): string | undefined {
  const id = msg.from?.id
  return typeof id === 'number' ? String(id) : undefined
}

export async function ensureBackendConfigured() {
  // Always set base URL; token will be set via setAccessToken when available
  configureBackendClient()
}

export function ensureAccessTokenForUser(userId: string) {
  const session = getSession(userId)
  if (session?.accessToken) {
    setAccessToken(session.accessToken)
  } else {
    setAccessToken(undefined)
  }
}

export async function promptForAccessCode(bot: TelegramBot, chatId: number) {
  await bot.sendMessage(
    chatId,
    [
      'To continue, please enter your access code.',
      "If you don't have one, request it from the app or administrator.",
      '',
      'You can cancel anytime with /cancel.',
    ].join('\n'),
  )
}

export async function handleAuthMessage(
  bot: TelegramBot,
  msg: TelegramBot.Message,
): Promise<boolean> {
  // Returns true if this message was handled by auth flow (either processed or prompted), false otherwise
  const chatId = msg.chat.id
  const userId = getTelegramUserId(msg)
  if (!userId) {
    await bot.sendMessage(chatId, 'Unable to determine your Telegram user id.')
    return true
  }

  await ensureBackendConfigured()

  // If user replied with /cancel while pending, clear pending and acknowledge
  const text = (msg.text || '').trim()
  if (pendingAccessCode.has(userId) && /^\/(cancel)(@\w+)?$/i.test(text)) {
    pendingAccessCode.delete(userId)
    await bot.sendMessage(chatId, 'Cancelled. You can restart with /start when ready.')
    return true
  }

  // If already authenticated and token valid, ensure client token and do not handle here
  if (isAuthenticated(userId)) {
    ensureAccessTokenForUser(userId)
    return false
  }

  // If user is pending and sent a non-command text, treat as access code
  if (pendingAccessCode.has(userId) && text && !text.startsWith('/')) {
    const accessCode = text
    try {
      const result = await AuthService.authControllerLoginTelegram({
        requestBody: {
          externalId: userId,
          accessCode,
          secret: config.backendSharedSecret,
        },
      })

      const now = Math.floor(Date.now() / 1000)
      const expiresAt = result?.expiresIn ? now + Number(result.expiresIn) : undefined

      setSession({
        userId,
        accessToken: result.accessToken,
        idToken: result.idToken,
        refreshToken: result.refreshToken,
        expiresAt,
      })

      setAccessToken(result.accessToken)

      pendingAccessCode.delete(userId)
      await bot.sendMessage(chatId, 'You are now authenticated. 🎉')
    } catch (err: any) {
      // On failure, do not clear pending, allow retry
      logger.warn('auth: login failed', {
        userId,
        error: err?.response?.data || err?.message || String(err),
      })
      await bot.sendMessage(
        chatId,
        'That access code did not work. Please try again, or /cancel to stop.',
      )
    }
    return true
  }

  // If not authenticated and not pending, prompt for access code and mark pending
  if (!pendingAccessCode.has(userId)) {
    pendingAccessCode.add(userId)
    await promptForAccessCode(bot, chatId)
    return true
  }

  // If pending but user sent a command or empty, ignore here so other handlers can run if needed
  return false
}

export function logoutUser(userId: string) {
  clearSession(userId)
  setAccessToken(undefined)
  pendingAccessCode.delete(userId)
}
