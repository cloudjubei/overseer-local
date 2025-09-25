import TelegramBot, { Message } from 'node-telegram-bot-api'
import {
  sendCategoryKeyboardMessage,
  sendDifficultyKeyboardMessage,
  sendTypeKeyboardMessage,
} from 'src/common/keyboards'
import {
  CheckInsService,
  CreateCheckInDto,
  CreateGoalDto,
  GoalsService,
  SuggestedGoalDto,
} from 'src/generated/backend'
import { ensureAccessTokenForUser, ensureBackendConfigured } from 'src/lib/auth'
import { getSession, setSession } from 'src/lib/sessionStore'
import { renderParamSuggestions, renderParamSuggestionsKeyboard } from './suggestionRenderer'
import { clearSuggestionsForMessage, getSuggestionsForMessage } from './suggestionState'

// This action now implements the /q param-based suggestion picker.
// Flow:
//  - /q -> present GoalCategory options inline
//  - user picks category -> callback handled in index.ts (q:cat:<CATEGORY>)
//  - then difficulty selection -> callback handled in index.ts (q:diff:<CATEGORY>:<DIFFICULTY>)
//  - backend suggestions are fetched and rendered via suggestionRenderer.renderParamSuggestions

export async function quickSuggestionAction2(
  bot: TelegramBot,
  chat: TelegramBot.Chat,
  _from: TelegramBot.User,
  rawText: string,
  messageId: number,
  hasResponse: number,
) {
  const userId = String(_from.id)
  const prev = getSession(userId)
  console.log(
    'quickSuggestionAction2 hasResponse:  ',
    hasResponse,
    ' lastAction: ',
    prev?.conversationState?.lastAction,
  )
  if (hasResponse >= 0) {
    if (prev?.conversationState?.lastAction === 'q2') {
      const responses = prev.conversationState?.responses ?? []
      responses.push(hasResponse)
      console.log('responses: ', responses)

      if (responses.length == 4) {
        const prevMessageId = prev.conversationState?.responsesMessageId ?? messageId
        await chooseSuggestion(bot, chat.id, userId, prevMessageId, hasResponse)
        return true
      }

      if (responses.length == 3) {
        try {
          await ensureBackendConfigured()
          ensureAccessTokenForUser(userId)

          const type = Object.values(SuggestedGoalDto.type)[responses[0]]
          const category = Object.values(SuggestedGoalDto.category)[responses[1]]
          const difficulty = Object.values(SuggestedGoalDto.difficulty)[responses[2]]

          const suggestions = await GoalsService.goalsControllerParamSuggestions({
            type: type,
            category: category,
            difficulty: difficulty,
          })

          const sent = await renderParamSuggestionsKeyboard(
            bot,
            chat.id,
            suggestions,
            'Great! Here are some options:',
          )
          setSession({
            ...(prev || { userId }),
            conversationState: {
              lastAction: 'q2',
              responses: responses,
              responsesMessageId: sent.message_id,
              flowId: '',
            },
            accessToken: prev?.accessToken || '',
            idToken: prev?.idToken,
            refreshToken: prev?.refreshToken,
            expiresAt: prev?.expiresAt,
          })
        } catch (err: any) {
          const errMsg = err?.response?.data || err?.message || 'Failed to get suggestions.'
          await bot.sendMessage(
            chat.id,
            typeof errMsg === 'string' ? errMsg : 'Failed to get suggestions.',
          )
        }
        return true
      }
      setSession({
        ...(prev || { userId }),
        conversationState: {
          lastAction: 'q2',
          responses: responses,
          flowId: '',
        },
        accessToken: prev?.accessToken || '',
        idToken: prev?.idToken,
        refreshToken: prev?.refreshToken,
        expiresAt: prev?.expiresAt,
      })
      const type = Object.values(SuggestedGoalDto.type)[responses[0]]
      if (responses.length == 2) {
        const category = Object.values(SuggestedGoalDto.category)[responses[1]]
        await sendDifficultyKeyboardMessage(bot, chat.id, type, category, false)
      } else {
        await sendCategoryKeyboardMessage(bot, chat.id, type, false)
      }
      return true
    }
  }
  const match = rawText.match(/^\/q2(?:@\w+)?(?:\s+([\s\S]*))?$/i)
  if (!match) {
    return false
  }

  setSession({
    ...(prev || { userId }),
    conversationState: {
      lastAction: 'q2',
      flowId: '',
    },
    accessToken: prev?.accessToken || '',
    idToken: prev?.idToken,
    refreshToken: prev?.refreshToken,
    expiresAt: prev?.expiresAt,
  })

  await sendTypeKeyboardMessage(bot, chat.id, false)
  return true
}
export default async function quickSuggestionAction(
  bot: TelegramBot,
  chat: TelegramBot.Chat,
  _from: TelegramBot.User,
  rawText: string,
  _msg: Message,
) {
  const match = rawText.match(/^\/q(?:@\w+)?(?:\s+([\s\S]*))?$/i)
  if (!match) {
    return false
  }
  const userId = String(_from.id)
  const prev = getSession(userId)
  setSession({
    ...(prev || { userId }),
    conversationState: {
      lastAction: 'q',
      flowId: '',
    },
    accessToken: prev?.accessToken || '',
    idToken: prev?.idToken,
    refreshToken: prev?.refreshToken,
    expiresAt: prev?.expiresAt,
  })

  await sendTypeKeyboardMessage(bot, chat.id, true)
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

    const body: CreateGoalDto = {
      type: chosen.type as any,
      category: chosen.category as any,
      difficulty: chosen.difficulty as any,
      text: chosen.text,
    }

    const created = await GoalsService.goalsControllerCreate({ requestBody: body })
    await CheckInsService.checkInsControllerAddCheckIn({
      requestBody: {
        start: new Date().toISOString(),
        frequency: CreateCheckInDto.frequency.DAILY,
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
