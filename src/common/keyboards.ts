import TelegramBot from 'node-telegram-bot-api'

export async function sendTypeKeyboardMessage(bot: TelegramBot, chatId: number) {
  const prompt =
    '<b>What type of goal do you want to set?</b>\n<i>Pick a type to get tailored goals.</i>'
  await bot.sendMessage(chatId, prompt, {
    parse_mode: 'HTML',
    reply_markup: buildTypeKeyboard(),
  })
}
export function buildTypeKeyboard(): TelegramBot.InlineKeyboardMarkup {
  const rows: TelegramBot.InlineKeyboardButton[][] = []
  const types: { key: string; label: string; emoji: string }[] = [
    { key: 'MICRO', label: 'Micro - Short Term Goals', emoji: '⚡' },
    { key: 'MACRO', label: 'Macro - Long Term Goals', emoji: '⏱️' },
  ]

  types.forEach((d) => {
    rows.push([
      {
        text: `${d.emoji} ${d.label}`,
        callback_data: `q:type:${d.key}`,
      },
    ])
  })

  return { inline_keyboard: rows }
}

export async function sendCategoryKeyboardMessage(bot: TelegramBot, chatId: number, type: string) {
  const prompt =
    '<b>What area do you want to focus on?</b>\n<i>Pick a category to get tailored goals.</i>'
  await bot.sendMessage(chatId, prompt, {
    parse_mode: 'HTML',
    reply_markup: buildCategoryKeyboard(type),
  })
}
export function buildCategoryKeyboard(type: string): TelegramBot.InlineKeyboardMarkup {
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
      { text: `${a.emoji} ${a.label}`, callback_data: `q:type:cat:${type}:${a.key}` },
    ]
    if (b) row.push({ text: `${b.emoji} ${b.label}`, callback_data: `q:type:cat:${type}:${b.key}` })
    rows.push(row)
  }

  return { inline_keyboard: rows }
}

export async function sendDifficultyKeyboardMessage(
  bot: TelegramBot,
  chatId: number,
  type: string,
  category: string,
) {
  const prompt = '<b>How ambitious do you feel?</b>\n<i>Pick a difficulty to tailor the goal.</i>'
  await bot.sendMessage(chatId, prompt, {
    parse_mode: 'HTML',
    reply_markup: buildDifficultyKeyboard(type, category),
  })
}
export function buildDifficultyKeyboard(
  type: string,
  category: string,
): TelegramBot.InlineKeyboardMarkup {
  const rows: TelegramBot.InlineKeyboardButton[][] = []
  const diffs: { key: string; label: string; emoji: string }[] = [
    { key: 'EASY', label: 'Easy', emoji: '⭐' },
    { key: 'MEDIUM', label: 'Medium', emoji: '⭐⭐' },
    { key: 'HARD', label: 'Ambitious', emoji: '⭐⭐⭐' },
  ]
  diffs.forEach((d) => {
    rows.push([
      {
        text: `${d.emoji} ${d.label}`,
        callback_data: `q:type:cat:diff:${type}:${category}:${d.key}`,
      },
    ])
  })
  return { inline_keyboard: rows }
}
