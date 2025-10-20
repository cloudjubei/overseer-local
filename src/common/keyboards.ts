import TelegramBot from 'node-telegram-bot-api'

export function buildActiveKeyboard(): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: 'Low', callback_data: 'lifestyle:active:1' },
        { text: 'Moderate', callback_data: 'lifestyle:active:2' },
        { text: 'High', callback_data: 'lifestyle:active:3' },
      ],
    ],
  }
}

export function buildEnergyKeyboard(): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: 'Low 😴', callback_data: 'lifestyle:energy:1' },
        { text: 'Okay 🙂', callback_data: 'lifestyle:energy:2' },
        { text: 'High 🤩', callback_data: 'lifestyle:energy:3' },
      ],
    ],
  }
}
export function buildMorningEnergyKeyboard(): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: 'Low 😴', callback_data: 'morning:energy:1' },
        { text: 'Okay 🙂', callback_data: 'morning:energy:2' },
        { text: 'High 🤩', callback_data: 'morning:energy:3' },
      ],
    ],
  }
}
