import TelegramBot, { CallbackQuery, Message } from 'node-telegram-bot-api';
import { config } from './config/env';
import { ensureAuthenticatedForMessage, ensureAuthenticatedForCallback, withUserSession } from './lib/auth';
import { getSession, saveSession } from './lib/sessionStore';
import { handleConversationMessage } from './conversations/conversationManager';
import { renderBackendPrompt } from './conversations/promptRenderer';

// Existing bot initialization and command handlers are assumed to be here
const bot = new TelegramBot(config.telegramBotToken, { polling: true });

// Message handler
bot.on('message', async (msg: Message) => {
  try {
    const { chat, from } = msg;
    if (!from || !chat) return;

    // Ensure user is authenticated or prompt for auth
    const authResult = await ensureAuthenticatedForMessage(bot, msg);
    if (!authResult.authenticated) {
      // Authentication flow has sent its own prompts; stop further handling
      return;
    }

    // Load session to check for active conversation
    const session = getSession(from.id);

    // Delegate to backend-driven conversation manager if there's an active conversation
    if (session?.conversationState) {
      const convHandled = await handleConversationMessage({ bot, msg, session });
      if (convHandled.handled) {
        // If a prompt is returned, render it via promptRenderer
        if (convHandled.type === 'prompt' && convHandled.prompt) {
          await renderBackendPrompt(convHandled.prompt, bot, chat.id);
        } else if (convHandled.type === 'success' && convHandled.message) {
          await bot.sendMessage(chat.id, convHandled.message);
        } else if (convHandled.type === 'error' && convHandled.message) {
          await bot.sendMessage(chat.id, convHandled.message);
        }
        return; // conversation consumed this message; do not process further
      }
    }

    // ... existing non-conversation message handling (commands like /start, /profile, /newgoal, etc.)
    // This code remains unchanged and will execute only if no active conversation consumed the message

  } catch (err) {
    // Minimal error handling consistent with code standards
    // Avoid leaking internals; log if needed (omitted here), notify user gracefully
    if (msg.chat?.id) {
      await bot.sendMessage(msg.chat.id, 'Sorry, something went wrong handling your message.');
    }
  }
});

// Callback query handler
bot.on('callback_query', async (cb: CallbackQuery) => {
  try {
    const from = cb.from;
    const message = cb.message;
    if (!from || !message) return;

    const authResult = await ensureAuthenticatedForCallback(bot, cb);
    if (!authResult.authenticated) {
      return;
    }

    const session = getSession(from.id);

    // If part of an active conversation, delegate to conversation manager
    if (session?.conversationState) {
      // We reuse handleConversationMessage by constructing a pseudo-message from callback data
      // conversationManager should internally support callback handling based on session state
      const convHandled = await handleConversationMessage({ bot, callbackQuery: cb, session });
      if (convHandled.handled) {
        // Acknowledge callback promptly
        try { await bot.answerCallbackQuery(cb.id); } catch {}

        if (convHandled.type === 'prompt' && convHandled.prompt) {
          await renderBackendPrompt(convHandled.prompt, bot, message.chat.id);
        } else if (convHandled.type === 'success' && convHandled.message) {
          await bot.sendMessage(message.chat.id, convHandled.message);
        } else if (convHandled.type === 'error' && convHandled.message) {
          await bot.sendMessage(message.chat.id, convHandled.message);
        }
        return; // stop further callback processing
      }
    }

    // ... existing non-conversation callback handling (e.g., newGoal suggestions)

  } catch (err) {
    if (cb.id) {
      try { await bot.answerCallbackQuery(cb.id, { text: 'An error occurred.' }); } catch {}
    }
    if (cb.message?.chat?.id) {
      await bot.sendMessage(cb.message.chat.id, 'Sorry, something went wrong handling your selection.');
    }
  }
});

// Export bot for tests if needed
export { bot };
