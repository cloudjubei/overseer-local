import TelegramBot from 'node-telegram-bot-api'
import { SuggestedGoalDto } from 'src/generated/backend'

export async function sendTypeKeyboardMessage(bot: TelegramBot, chatId: number, inline: boolean) {
  const prompt =
    '<b>What type of goal do you want to set?</b>\n<i>Pick a type to get tailored goals.</i>'
  await bot.sendMessage(chatId, prompt, {
    parse_mode: 'HTML',
    reply_markup: inline ? buildTypeKeyboardInline() : buildTypeKeyboard(),
  })
}
export function buildTypeKeyboardInline(): TelegramBot.InlineKeyboardMarkup {
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
export function buildTypeKeyboard(): TelegramBot.ReplyKeyboardMarkup {
  const rows: TelegramBot.KeyboardButton[][] = []
  const types: { key: string; label: string; emoji: string }[] = [
    { key: 'MICRO', label: 'Micro - Short Term Goals', emoji: '⚡' },
    { key: 'MACRO', label: 'Macro - Long Term Goals', emoji: '⏱️' },
  ]
  types.forEach((t, index) => {
    rows.push([{ text: `${'‎'.repeat(index + 1)}${t.emoji} ${t.label}` }])
  })
  return { keyboard: rows, resize_keyboard: true, is_persistent: true }
}

export async function sendCategoryKeyboardMessage(
  bot: TelegramBot,
  chatId: number,
  type: string,
  inline: boolean,
) {
  const prompt =
    '<b>What area do you want to focus on?</b>\n<i>Pick a category to get tailored goals.</i>'
  await bot.sendMessage(chatId, prompt, {
    parse_mode: 'HTML',
    reply_markup: inline ? buildCategoryKeyboardInline(type) : buildCategoryKeyboard(),
  })
}
export function buildCategoryKeyboardInline(type: string): TelegramBot.InlineKeyboardMarkup {
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
export function buildCategoryKeyboard(): TelegramBot.ReplyKeyboardMarkup {
  const rows: TelegramBot.KeyboardButton[][] = []
  const cats: { key: string; label: string; emoji: string }[] = [
    { key: 'FITNESS', label: 'Fitness', emoji: '🏃' },
    { key: 'SLEEP', label: 'Sleep', emoji: '😴' },
    { key: 'FOCUS', label: 'Focus', emoji: '🎯' },
    { key: 'STRESS', label: 'Stress', emoji: '🧘' },
    { key: 'OTHER', label: 'Other', emoji: '✨' },
  ]
  cats.forEach((c, index) => {
    rows.push([{ text: `${'‎'.repeat(index + 1)}${c.emoji} ${c.label}` }])
  })
  return { keyboard: rows, resize_keyboard: true, is_persistent: true }
}

export async function sendDifficultyKeyboardMessage(
  bot: TelegramBot,
  chatId: number,
  type: string,
  category: string,
  inline: boolean,
) {
  const prompt = '<b>How ambitious do you feel?</b>\n<i>Pick a difficulty to tailor the goal.</i>'
  await bot.sendMessage(chatId, prompt, {
    parse_mode: 'HTML',
    reply_markup: inline
      ? buildDifficultyKeyboardInline(type, category)
      : buildDifficultyKeyboard(),
  })
}

export function buildDifficultyKeyboardInline(
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

export function buildDifficultyKeyboard(): TelegramBot.ReplyKeyboardMarkup {
  const rows: TelegramBot.KeyboardButton[][] = []
  const diffs: { key: string; label: string; emoji: string }[] = [
    { key: 'EASY', label: 'Easy', emoji: '⭐' },
    { key: 'MEDIUM', label: 'Medium', emoji: '⭐⭐' },
    {
      key: 'HARD',
      label: 'Ambitious',
      emoji: '⭐⭐⭐',
    },
  ]
  diffs.forEach((d, index) => {
    rows.push([
      {
        text: `${'‎'.repeat(index + 1)}${d.emoji} ${d.label}`,
      },
    ])
  })
  return { keyboard: rows, resize_keyboard: true, is_persistent: true }
}

export function difficultyStars(d?: SuggestedGoalDto.difficulty | string): string {
  const diff = String(d || '').toUpperCase()
  const count = diff === 'MEDIUM' ? 2 : diff === 'HARD' ? 3 : 1
  return '★'.repeat(count)
}

export function buildSuggestionKeyboardInline(
  suggestions: SuggestedGoalDto[],
  showExtraSuggestions: boolean = false,
): TelegramBot.InlineKeyboardMarkup {
  const rows: TelegramBot.InlineKeyboardButton[][] = []

  const isSameDifficulty = suggestions.every((s) => s.difficulty === suggestions[0].difficulty)

  suggestions.forEach((sug, idx) => {
    const label = isSameDifficulty ? sug.summary : difficultyStars(sug.difficulty)
    const n = idx + 1
    const text = `${n} • ${label}`
    rows.push([
      {
        text,
        callback_data: `suggest:choose:${idx}`,
      },
    ])
  })

  if (showExtraSuggestions) {
    rows.push([
      {
        text: '✏️ Refine',
        callback_data: 'suggest:refine',
      },
      {
        text: '📋 Select',
        callback_data: 'suggest:select',
      },
    ])
  } else {
    rows.push([
      {
        text: '✏️ Refine',
        callback_data: 'suggest:refine',
      },
    ])
  }

  return { inline_keyboard: rows }
}

export function buildSuggestionKeyboard(
  suggestions: SuggestedGoalDto[],
  showExtraSuggestions: boolean = false,
): TelegramBot.ReplyKeyboardMarkup {
  const prep: string[] = []
  const isSameDifficulty = suggestions.every((s) => s.difficulty === suggestions[0].difficulty)

  suggestions.forEach((sug, idx) => {
    const label = isSameDifficulty ? sug.summary : difficultyStars(sug.difficulty)
    const n = idx + 1
    const text = `${n} • ${label}`
    prep.push(text)
  })

  if (showExtraSuggestions) {
    prep.push('📋 Select')
    prep.push('✏️ Refine')
  } else {
    prep.push('✏️ Refine')
  }

  const keyboard: TelegramBot.KeyboardButton[][] = prep.map((text, index) => {
    return [
      {
        text: `${'‎'.repeat(index + 1)}${text}`,
      },
    ]
  })
  return { keyboard, resize_keyboard: true, is_persistent: true }
}
