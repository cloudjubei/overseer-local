import TelegramBot from 'node-telegram-bot-api'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { GoalsService } from '../generated/backend'

interface NewGoalFlowState {
  chatId: number
  step: 'ask_text' | 'await_refine' | 'showing_suggestions' | 'creating' | 'cancelled'
  lastInputText?: string // latest user-provided free text
  suggestions?: Array<{ text: string; type: string; category: string; difficulty: string }>
  suggestionsMessageId?: number // message id where suggestions were shown
}

const flows = new Map<string, NewGoalFlowState>() // key: userId

export function isInNewGoalFlow(userId: string): boolean {
  return flows.has(userId)
}

export async function startNewGoalFlow(bot: TelegramBot, userId: string, chatId: number) {
  flows.set(userId, { chatId, step: 'ask_text' })
  await bot.sendMessage(
    chatId,
    [
      "Let's create a new goal.",
      'Describe what you want to achieve in a sentence or two. I will suggest options you can pick from.',
      '',
      'You can /cancel anytime.',
    ].join('\n'),
  )
}

export async function cancelNewGoalFlow(bot: TelegramBot, userId: string) {
  const state = flows.get(userId)
  if (state) {
    flows.delete(userId)
    await bot.sendMessage(state.chatId, 'Okay, cancelled goal creation.')
  }
}

async function fetchSuggestionsFromBackend(text: string) {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const res = await GoalsService.goalsControllerAiSuggestions({ requestBody: { text } })
  const suggestions = Array.isArray(res?.suggestions) ? res.suggestions : []
  return {
    suggestions: suggestions.map((s: any) => ({
      text: String(s?.text || ''),
      type: String(s?.type || 'OTHER'),
      category: String(s?.category || 'OTHER'),
      difficulty: String(s?.difficulty || 'OTHER'),
    })),
    understoodText: typeof res?.understoodText === 'string' ? res.understoodText : undefined,
    message: typeof res?.message === 'string' ? res.message : undefined,
  }
}

function buildSuggestionsKeyboard(suggestions: NewGoalFlowState['suggestions']) {
  const rows: TelegramBot.InlineKeyboardButton[][] = []
  if (suggestions && suggestions.length) {
    for (let i = 0; i < Math.min(suggestions.length, 8); i++) {
      const s = suggestions[i]!
      const label = s.text.length > 60 ? s.text.slice(0, 57) + '…' : s.text
      rows.push([
        {
          text: `➕ ${label}`,
          callback_data: `goals:pick:${i}`,
        },
      ])
    }
  }
  // Actions row
  rows.push([
    { text: '✏️ Refine message', callback_data: 'goals:refine' },
    { text: '✖️ Cancel', callback_data: 'goals:cancel' },
  ])
  return { inline_keyboard: rows } as TelegramBot.InlineKeyboardMarkup
}

export async function handleNewGoalFlowMessage(
  bot: TelegramBot,
  userId: string,
  msg: TelegramBot.Message,
) {
  const state = flows.get(userId)
  if (!state) return

  const text = (msg.text || '').trim()

  // Allow /cancel at any time
  if (/^\/(cancel)(@\w+)?$/i.test(text)) {
    await cancelNewGoalFlow(bot, userId)
    return
  }

  if (state.step === 'ask_text' || state.step === 'await_refine') {
    if (!text || text.startsWith('/')) {
      await bot.sendMessage(state.chatId, 'Please enter your goal idea in your own words.')
      return
    }
    state.lastInputText = text
    await bot.sendChatAction(state.chatId, 'typing')
    try {
      const { suggestions, understoodText, message } = await fetchSuggestionsFromBackend(text)
      state.suggestions = suggestions
      state.step = 'showing_suggestions'
      flows.set(userId, state)

      const lines: string[] = []
      if (message) lines.push(message)
      if (understoodText) lines.push(`I understood: "${understoodText}"`)
      if (!suggestions.length) {
        lines.push('I could not generate suggestions. You can try refining your message.')
      } else {
        lines.push('Here are some suggested goals:')
        for (let i = 0; i < Math.min(suggestions.length, 8); i++) {
          const s = suggestions[i]!
          const meta = `[${s.type}/${s.category}/${s.difficulty}]`
          lines.push(`${i + 1}. ${s.text} ${meta}`)
        }
      }

      const sent = await bot.sendMessage(state.chatId, lines.join('\n'), {
        reply_markup: buildSuggestionsKeyboard(state.suggestions),
      })
      state.suggestionsMessageId = sent.message_id
      flows.set(userId, state)
    } catch (err: any) {
      console.error('Failed to fetch AI suggestions', err?.response?.data || err?.message || err)
      await bot.sendMessage(
        state.chatId,
        'Sorry, I could not get suggestions right now. Please try again later.',
      )
      // Keep flow in ask_text so they can retry
      state.step = 'ask_text'
      flows.set(userId, state)
    }
    return
  }

  // If in other steps and received arbitrary text, ignore; actions are via buttons
}

export async function handleNewGoalCallback(
  bot: TelegramBot,
  userId: string,
  query: TelegramBot.CallbackQuery,
) {
  const state = flows.get(userId)
  // Only handle if the callback_data is for goals flow
  const data = query.data || ''
  if (!data.startsWith('goals:') || !state) return false

  const chatId = state.chatId
  const msgId = query.message?.message_id

  const answer = async (text?: string) => {
    try {
      await bot.answerCallbackQuery(query.id, text ? { text, show_alert: false } : undefined)
    } catch {}
  }

  if (data === 'goals:cancel') {
    await answer()
    await cancelNewGoalFlow(bot, userId)
    return true
  }

  if (data === 'goals:refine') {
    await answer()
    state.step = 'await_refine'
    flows.set(userId, state)
    await bot.sendMessage(chatId, 'Please refine or clarify your goal idea.')
    return true
  }

  const pickMatch = data.match(/^goals:pick:(\d{1,2})$/)
  if (pickMatch) {
    await answer()
    const idx = Number(pickMatch[1])
    const s = state.suggestions && state.suggestions[idx]
    if (!s) {
      await bot.sendMessage(chatId, 'That suggestion is no longer available. Please try again.')
      return true
    }

    // Create goal immediately using selected suggestion
    state.step = 'creating'
    flows.set(userId, state)

    await bot.sendChatAction(chatId, 'typing')
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const created = await GoalsService.goalsControllerCreate({
        requestBody: {
          type: s.type,
          category: s.category,
          difficulty: s.difficulty,
          text: s.text,
        },
      })

      // Clean up flow on success
      flows.delete(userId)

      const meta = `[${created?.type || s.type}/${created?.category || s.category}/${created?.difficulty || s.difficulty}]`
      await bot.sendMessage(chatId, `✅ Goal created: ${created?.text || s.text} ${meta}`)
      if (msgId) {
        // Optionally edit the original suggestions message to indicate completion
        try {
          await bot.editMessageReplyMarkup(
            { inline_keyboard: [] },
            { chat_id: chatId, message_id: msgId },
          )
        } catch {}
      }
    } catch (err: any) {
      console.error('Failed to create goal', err?.response?.data || err?.message || err)
      state.step = 'showing_suggestions'
      flows.set(userId, state)
      await bot.sendMessage(
        chatId,
        'Sorry, I could not create that goal. Please try another suggestion or refine your message.',
      )
    }
    return true
  }

  // Unknown action for this flow
  return false
}
