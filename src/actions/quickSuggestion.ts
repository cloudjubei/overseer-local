import TelegramBot, { Message } from 'node-telegram-bot-api'
import { sendTypeKeyboardMessage } from 'src/common/keyboards'

// This action now implements the /q param-based suggestion picker.
// Flow:
//  - /q -> present GoalCategory options inline
//  - user picks category -> callback handled in index.ts (q:cat:<CATEGORY>)
//  - then difficulty selection -> callback handled in index.ts (q:diff:<CATEGORY>:<DIFFICULTY>)
//  - backend suggestions are fetched and rendered via suggestionRenderer.renderParamSuggestions

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

  await sendTypeKeyboardMessage(bot, chat.id)
  return true
}
