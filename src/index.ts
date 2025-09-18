// Main entry point for the Compass Telegram Bot
// - Loads environment variables
// - Instantiates node-telegram-bot-api
// - Sets up a basic, extensible command handler structure

import TelegramBot from 'node-telegram-bot-api';
import { config } from './config/env';
import { handleAuthMessage, getTelegramUserId, logoutUser } from './lib/auth';
import {
  startProfileFlow,
  handleProfileFlowMessage,
  isInProfileFlow,
  cancelProfileFlow,
} from './flows/profile';

// Basic command handler types
export type CommandHandler = (ctx: {
  bot: TelegramBot;
  msg: TelegramBot.Message;
  args: string[];
}) => Promise<void> | void;

class CommandRegistry {
  private commands: Map<string, { handler: CommandHandler; description?: string }> = new Map();

  register(command: string, handler: CommandHandler, description?: string) {
    const key = command.replace(/^\//, '').toLowerCase();
    this.commands.set(key, { handler, description });
  }

  get(command: string) {
    return this.commands.get(command.toLowerCase());
  }

  listForBotCommands(): Array<{ command: string; description: string }> {
    const list: Array<{ command: string; description: string }> = [];
    for (const [command, { description }] of this.commands.entries()) {
      if (description) list.push({ command, description });
    }
    return list;
  }
}

async function main() {
  const token = config.telegramBotToken;

  const bot = new TelegramBot(token, { polling: true });
  const commands = new CommandRegistry();

  // Register base commands
  commands.register(
    'start',
    async ({ bot, msg }) => {
      const chatId = msg.chat.id;
      const name = msg.from?.first_name || 'there';
      const welcome = [
        `Hi ${name}! Welcome to Compass.`,
        "I'm your assistant to help manage your goals.",
        '',
        'If this is your first time, please provide your access code when prompted.',
      ].join('\n');

      await bot.sendMessage(chatId, welcome, { parse_mode: 'HTML' });
      // Auth prompting is handled globally in the message listener before commands.
    },
    'Start interacting with the bot'
  );

  commands.register(
    'logout',
    async ({ bot, msg }) => {
      const chatId = msg.chat.id;
      const userId = getTelegramUserId(msg);
      if (!userId) {
        await bot.sendMessage(chatId, 'Unable to determine your Telegram user id.');
        return;
      }
      logoutUser(userId);
      await bot.sendMessage(chatId, 'You have been logged out. Send any message to authenticate again.');
    },
    'Log out and clear your session'
  );

  // Profile update flow command
  commands.register(
    'profile',
    async ({ bot, msg }) => {
      const chatId = msg.chat.id;
      const userId = getTelegramUserId(msg);
      if (!userId) {
        await bot.sendMessage(chatId, 'Unable to determine your Telegram user id.');
        return;
      }
      await startProfileFlow(bot, userId, chatId);
    },
    'Update your profile (DOB, gender, weight, height)'
  );

  // Optional: expose /cancel to cancel active flows
  commands.register(
    'cancel',
    async ({ bot, msg }) => {
      const userId = getTelegramUserId(msg);
      if (!userId) return;
      if (isInProfileFlow(userId)) {
        await cancelProfileFlow(bot, userId);
      } else {
        await bot.sendMessage(msg.chat.id, 'Nothing to cancel.');
      }
    },
    'Cancel the current action'
  );

  // Sync bot command list (as shown in Telegram UI)
  try {
    const botCommands = commands.listForBotCommands();
    if (botCommands.length > 0) {
      await bot.setMyCommands(botCommands);
    }
  } catch (err) {
    // Non-fatal
    console.warn('Failed to set bot commands:', err);
  }

  // Global message listener: ensure authentication flow first
  bot.on('message', async (msg) => {
    try {
      // Run authentication gate. If it handles the message (prompt/login), stop here.
      const handledByAuth = await handleAuthMessage(bot, msg);
      if (handledByAuth) return;

      const userId = getTelegramUserId(msg);
      if (!userId) {
        await bot.sendMessage(msg.chat.id, 'Unable to determine your Telegram user id.');
        return;
      }

      // If user is currently in a conversation flow, route message to it and stop.
      if (isInProfileFlow(userId)) {
        await handleProfileFlowMessage(bot, userId, msg);
        return;
      }

      const text = msg.text || '';
      if (!text.startsWith('/')) {
        // For now ignore non-commands if authenticated; flows handle their own inputs above.
        return;
      }

      // Extract command and args. Support forms like /start and /start@BotName
      const [first, ...rest] = text.trim().split(/\s+/);
      const rawCommand = first.slice(1); // remove leading '/'
      const commandOnly = rawCommand.split('@')[0].toLowerCase();
      const args = rest;

      const def = commands.get(commandOnly);
      if (!def) {
        // Optional: basic unknown command feedback
        await bot.sendMessage(msg.chat.id, `Unknown command: /${commandOnly}`);
        return;
      }

      await def.handler({ bot, msg, args });
    } catch (err) {
      console.error('Error handling message:', err);
      await bot.sendMessage(msg.chat.id, 'Sorry, something went wrong while processing your message.');
    }
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}. Stopping bot polling...`);
    try {
      await bot.stopPolling();
      console.log('Bot polling stopped. Exiting.');
    } catch (err) {
      console.error('Error during shutdown:', err);
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  console.log(`Compass Telegram Bot started. Environment: ${config.nodeEnv}. Timezone: ${config.timezone}`);
}

main().catch((err) => {
  console.error('Fatal error starting bot:', err);
  process.exit(1);
});
