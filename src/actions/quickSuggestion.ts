import TelegramBot, { Message } from 'node-telegram-bot-api'

// This action now implements the /q param-based suggestion picker.
// Flow:
//  - /q -> present GoalCategory options inline
//  - user picks category -> callback handled in index.ts (q:cat:<CATEGORY>)
//  - then difficulty selection -> callback handled in index.ts (q:diff:<CATEGORY>:<DIFFICULTY>)
//  - backend suggestions are fetched and rendered via suggestionRenderer.renderParamSuggestions

function buildCategoryKeyboard(): TelegramBot.InlineKeyboardMarkup {
  const rows: TelegramBot.InlineKeyboardButton[][] = []
  const cats: { key: string; label: string; emoji: string }[] = [
    { key: 'FITNESS', label: 'Fitness', emoji: '🏃' },
    { key: 'SLEEP', label: 'Sleep', emoji: '😴' },
    { key: 'FOCUS', label: 'Focus', emoji: '🎯' },
    { key: 'STRESS', label: 'Stress', emoji: '🧘' },
    { key: 'OTHER', label: 'Other', emoji: '✨' },
  ]

  // Arrange 2 per row for nicer layout
  for (let i = 0; i < cats.length; i += 2) {
    const a = cats[i]
    const b = cats[i + 1]
    const row: TelegramBot.InlineKeyboardButton[] = [
      { text: `${a.emoji} ${a.label}`, callback_data: `q:cat:${a.key}` },
    ]
    if (b) row.push({ text: `${b.emoji} ${b.label}`, callback_data: `q:cat:${b.key}` })
    rows.push(row)
  }

  return { inline_keyboard: rows }
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

  // For /q we ignore any trailing free text and guide the user through param picks
  const header = '<b>What area do you want to focus on?</b>\n<i>Pick a category to get tailored goals.</i>'
  await bot.sendMessage(chat.id, header, { parse_mode: 'HTML', reply_markup: buildCategoryKeyboard() })
  return true
}
