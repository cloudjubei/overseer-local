import TelegramBot from 'node-telegram-bot-api'
import { GoalsService } from 'src/generated/backend'
import actionMacroGoal from './actionMacroGoal'

// In-memory store for callback query handling
const weeklyResetCallbackStore = new Map<string, any>()

function keyFor(chatId: number, messageId: number) {
  return `${chatId}:${messageId}`
}

export default async function actionWeeklyReset(
  bot: TelegramBot,
  chatId: number,
  from: TelegramBot.User,
) {
  try {
    const activeMacroGoal = await GoalsService.goalsControllerGetActiveMacroGoal()
    if (!activeMacroGoal) {
      // Should not happen if a weekly check-in is triggered, but handle it.
      await bot.sendMessage(chatId, "You don't have an active goal right now.")
      return
    }

    const microGoals = await GoalsService.goalsControllerGetMicroGoals({
      macroGoalId: activeMacroGoal.id,
    })

    const completedMicroGoals = microGoals.filter((g) => g.status === 'DONE').length
    const totalMicroGoals = microGoals.length
    const completionPercentage =
      totalMicroGoals > 0 ? Math.round((completedMicroGoals / totalMicroGoals) * 100) : 0

    await bot.sendMessage(
      chatId,
      `This week you completed ${completionPercentage}% of your micro goals — great work 💪.`,
    )

    const sent = await bot.sendMessage(
      chatId,
      'Would you like to set a new weekly goal or continue building on this one?',
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'Continue',
                callback_data: 'weekly_reset:continue',
              },
              {
                text: 'New Goal',
                callback_data: 'weekly_reset:new_goal',
              },
            ],
          ],
        },
      },
    )
    weeklyResetCallbackStore.set(keyFor(chatId, sent.message_id), { from })
  } catch (error) {
    console.error('actionWeeklyReset error:', error)
    await bot.sendMessage(
      chatId,
      'Something went wrong during the weekly review. Please try setting a new goal manually with /newgoal.',
    )
  }
}

export async function handleWeeklyResetCallback(
  bot: TelegramBot,
  query: TelegramBot.CallbackQuery,
) {
  const { data, message } = query
  if (!data || !message) return

  const chatId = message.chat.id
  const messageId = message.message_id
  const storedData = weeklyResetCallbackStore.get(keyFor(chatId, messageId))
  if (!storedData) {
    await bot.answerCallbackQuery(query.id)
    await bot.editMessageText('This action has expired.', {
      chat_id: chatId,
      message_id: messageId,
    })
    return
  }
  const { from } = storedData

  // remove keyboard
  await bot.editMessageReplyMarkup(
    { inline_keyboard: [] },
    { chat_id: chatId, message_id: messageId },
  )

  const [_, action] = data.split(':')

  if (action === 'continue') {
    await bot.sendMessage(chatId, 'Great! Keep up the good work!')
  } else if (action === 'new_goal') {
    await actionMacroGoal(bot, message.chat, from, '', message)
  }

  weeklyResetCallbackStore.delete(keyFor(chatId, messageId))
  await bot.answerCallbackQuery(query.id)
}
