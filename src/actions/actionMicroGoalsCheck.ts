import TelegramBot, { Message } from 'node-telegram-bot-api'
import { GoalsService } from 'src/generated/backend'
import { GoalModel } from 'src/generated/backend/models/GoalModel'
import { MicroGoalStateUpdateModel } from 'src/generated/backend/models/MicroGoalStateUpdateModel'
import actionMacroGoal from './actionMacroGoal'

// In-memory store mapping a message to its micro goals snapshot
// Key: `${chatId}:${messageId}`
export type StoredMicroGoal = { id: string; text: string; state: GoalModel.state }
const microCheckStore = new Map<string, StoredMicroGoal[]>()

function keyFor(chatId: number, messageId: number) {
  return `${chatId}:${messageId}`
}

function escapeHtml(input: string): string {
  return (input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function statusIcon(state: GoalModel.state): string {
  return state === GoalModel.state.SUCCESS ? '✅' : '⬜️'
}

export function getStoredMicroCheck(
  chatId: number,
  messageId: number,
): StoredMicroGoal[] | undefined {
  return microCheckStore.get(keyFor(chatId, messageId))
}

export function setStoredMicroCheck(chatId: number, messageId: number, goals: StoredMicroGoal[]) {
  microCheckStore.set(keyFor(chatId, messageId), goals)
}

export function clearStoredMicroCheck(chatId: number, messageId: number) {
  microCheckStore.delete(keyFor(chatId, messageId))
}

export function buildMicroCheckMessage(goals: StoredMicroGoal[]): string {
  const header =
    '<b>Evening check-in</b>\nHow did your day go?\nWhich micro goals did you complete?'
  const list = goals
    .map((g, index) => `${index + 1}. ${statusIcon(g.state)} ${escapeHtml(g.text || '')}`)
    .join('\n')
  return [header, '', list].join('\n')
}

export function buildMicroCheckKeyboard(
  goals: StoredMicroGoal[],
): TelegramBot.InlineKeyboardMarkup {
  const rows: TelegramBot.InlineKeyboardButton[][] = []
  goals.forEach((g, index) => {
    const isDone = g.state === GoalModel.state.SUCCESS
    const buttonNumber = index + 1
    rows.push([
      {
        text: isDone ? `${buttonNumber}. Mark ❎` : `${buttonNumber}. Mark ✅`,
        callback_data: `microcheck:${g.id}:toggle`,
      },
    ])
  })
  // Add a final row to let user finish explicitly
  rows.push([
    {
      text: 'Finish',
      callback_data: 'microcheck:finish',
    },
  ])
  return { inline_keyboard: rows }
}

export async function toggleMicroGoalState(goal: StoredMicroGoal): Promise<GoalModel.state> {
  // Toggle: SUCCESS <-> FAIL/ACTIVE treated as incomplete
  const nextState =
    goal.state === GoalModel.state.SUCCESS
      ? MicroGoalStateUpdateModel.state.FAIL
      : MicroGoalStateUpdateModel.state.SUCCESS
  const updated = await GoalsService.goalsControllerUpdateMicroGoalState({
    id: goal.id,
    requestBody: { state: nextState },
  })
  return updated.state
}

export default async function actionMicroGoalsCheck(
  bot: TelegramBot,
  chat: TelegramBot.Chat,
  _from: TelegramBot.User,
  _rawText: string,
  _msg: Message,
) {
  const chatId = chat.id
  try {
    const current = await GoalsService.goalsControllerGetCurrentMacroGoal()
    if (!current) {
      await actionMacroGoal(bot, chat, _from, _rawText, _msg)
      return true
    }
    const microGoals = await GoalsService.goalsControllerListMicroGoalsForMacro({ id: current.id })
    if (!microGoals.length) {
      await bot.sendMessage(
        chatId,
        'How did your day go? It looks like there are no micro goals to check right now.',
      )
      return true
    }

    const simplified: StoredMicroGoal[] = microGoals.map((g) => ({
      id: g.id,
      text: g.text || '',
      state: g.state,
    }))

    const text = buildMicroCheckMessage(simplified)
    const keyboard = buildMicroCheckKeyboard(simplified)

    const sent = await bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: keyboard })

    // Persist the state snapshot for subsequent toggles
    setStoredMicroCheck(chatId, sent.message_id, simplified)
  } catch (err) {
    console.log('err: ', err)
    await bot.sendMessage(
      chatId,
      'Sorry, I could not load your micro goals for check-in. Please try again later.',
    )
  }

  // FLOW continues via callback_query handlers
  return true
}
