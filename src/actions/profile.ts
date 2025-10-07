import TelegramBot, { Message } from 'node-telegram-bot-api'
import {
  CheckInModel,
  CheckInsService,
  ConversationResponseModel,
  ConversationsService,
  GoalCreateModel,
  GoalsService,
  StartFlowModel,
} from 'src/generated/backend'
import { ensureAccessTokenForUser, ensureBackendConfigured } from 'src/lib/auth'
import { clearSuggestionsForMessage, getSuggestionsForMessage } from './suggestionState'
import { getSession, setSession } from 'src/lib/sessionStore'
import { renderBackendPrompt } from 'src/conversations/promptRenderer'

export default async function profileAction(
  bot: TelegramBot,
  chat: TelegramBot.Chat,
  _from: TelegramBot.User,
  rawText: string,
  _msg: Message,
) {
  const match = rawText.match(/^\/(profile)(@\w+)?$/i)
  console.log('match for profile: ', match)
  if (!match) {
    return false
  }

  const userId = String(_from.id)
  const PROFILE_UPDATE_FLOW_ID = 'setup_profile' // Backend flow id for updating a profile

  console.log('starting backend flow:')
  await startBackendFlow(bot, {
    userId,
    chatId: chat.id,
    flowId: PROFILE_UPDATE_FLOW_ID,
    externalId: userId,
  })

  // const userId = String(_from.id)
  // const prev = getSession(userId)
  // setSession({
  //   ...(prev || { userId }),
  //   conversationState: {
  //     lastAction: 'q',
  //     flowId: '',
  //   },
  //   accessToken: prev?.accessToken || '',
  //   idToken: prev?.idToken,
  //   refreshToken: prev?.refreshToken,
  //   expiresAt: prev?.expiresAt,
  // })

  // await sendTypeKeyboardMessage(bot, chat.id, true)
  return true
}

export async function chooseSuggestion(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  messageId: number,
  index: number,
) {
  if (!Number.isFinite(index)) {
    await bot.sendMessage(chatId, 'Invalid selection.')
    return
  }

  const suggestions = getSuggestionsForMessage(chatId, messageId) || []
  const chosen = suggestions[index]
  if (!chosen) {
    await bot.sendMessage(chatId, 'That option has expired. Please request suggestions again.')
    return
  }

  try {
    await ensureBackendConfigured()
    ensureAccessTokenForUser(userId)

    const body: GoalCreateModel = {
      type: chosen.type as any,
      category: chosen.category as any,
      difficulty: chosen.difficulty as any,
      text: chosen.text,
    }

    const created = await GoalsService.goalsControllerCreate({ requestBody: body })
    await CheckInsService.checkInsControllerAddCheckIn({
      requestBody: {
        start: new Date().toISOString(),
        frequency: CheckInModel.frequency.DAILY,
        metadata: {
          message: `<b>Check In!</b>\n<i>I hope you're on track of your goal:</i>\n${created.text}`,
          chatId,
        },
      },
    })

    // Remove keyboard to prevent duplicate submissions
    try {
      await bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        { chat_id: chatId, message_id: messageId },
      )
    } catch {}

    clearSuggestionsForMessage(chatId, messageId)

    const confirm = `✅ Goal created: ${created.text}`
    await bot.sendMessage(chatId, confirm, {
      parse_mode: 'HTML',
      reply_markup: { remove_keyboard: true },
    })
  } catch (err: any) {
    const errMsg = err?.response?.data || err?.message || 'Failed to create goal.'
    await bot.sendMessage(chatId, typeof errMsg === 'string' ? errMsg : 'Failed to create goal.')
  }
}

// Helper to start a backend conversation flow and process the initial response
async function startBackendFlow(
  bot: TelegramBot,
  params: {
    userId: string
    chatId: number
    flowId: string
    externalId?: string
  },
) {
  const { userId, chatId, flowId, externalId } = params

  await ensureBackendConfigured()
  ensureAccessTokenForUser(userId)

  const req: StartFlowModel = {
    flow: flowId,
    channel: StartFlowModel.channel.TELEGRAM,
    externalId,
  }

  try {
    const res = await ConversationsService.conversationsControllerStart({ requestBody: req })

    const flow = res.flow
    const sessionId = res.sessionId
    const now = Math.floor(Date.now() / 1000)

    switch (res.type) {
      case ConversationResponseModel.type.PROMPT: {
        // Persist conversation state
        const prev = getSession(userId)
        setSession({
          ...(prev || { userId }),
          conversationState: {
            lastAction: '',
            flowId: flow,
            context: { sessionId },
            lastUpdatedAt: now,
          },
          accessToken: prev?.accessToken || '',
          idToken: prev?.idToken,
          refreshToken: prev?.refreshToken,
          expiresAt: prev?.expiresAt,
        })
        if (res.prompt) {
          await renderBackendPrompt(res.prompt, bot, chatId)
        }
        break
      }
      case ConversationResponseModel.type.SUCCESS: {
        // Clear conversation state and show success message if provided
        const prev = getSession(userId)
        setSession({
          ...(prev || { userId }),
          conversationState: null,
          accessToken: prev?.accessToken || '',
          idToken: prev?.idToken,
          refreshToken: prev?.refreshToken,
          expiresAt: prev?.expiresAt,
        })
        const text = (res.success as any)?.message || 'Done.'
        await bot.sendMessage(chatId, text)
        break
      }
      case ConversationResponseModel.type.ERROR: {
        // Decide whether to keep conversation based on retry flag
        const retry = !!(res.error as any)?.retry
        const prev = getSession(userId)
        setSession({
          ...(prev || { userId }),
          conversationState: retry
            ? {
                lastAction: '',
                flowId: flow,
                context: { sessionId },
                lastUpdatedAt: now,
              }
            : null,
          accessToken: prev?.accessToken || '',
          idToken: prev?.idToken,
          refreshToken: prev?.refreshToken,
          expiresAt: prev?.expiresAt,
        })
        const msg = (res.error as any)?.message || 'Something went wrong.'
        await bot.sendMessage(chatId, msg)
        break
      }
      default: {
        await bot.sendMessage(chatId, 'Unexpected response while starting the flow.')
        break
      }
    }
  } catch (err: any) {
    // Minimal user-facing error message
    console.error('startBackendFlow error', err?.response?.data || err?.message || err)
    await bot.sendMessage(
      chatId,
      'Sorry, failed to start the conversation. Please try again later.',
    )
  }
}
