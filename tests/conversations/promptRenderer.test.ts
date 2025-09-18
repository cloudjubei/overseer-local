import { describe, it, expect, vi } from 'vitest';
import type TelegramBot from 'node-telegram-bot-api';
import { formatPromptMessage, renderBackendPrompt } from '../../src/conversations/promptRenderer';
import type { ConversationPromptDto } from '../../src/generated/backend';

describe('conversations/promptRenderer', () => {
  describe('formatPromptMessage', () => {
    it('should format a message with title and message', () => {
      const prompt: ConversationPromptDto = { title: 'Hello', message: 'World' };
      const expected = 'Hello\n\nWorld';
      expect(formatPromptMessage(prompt)).toBe(expected);
    });

    it('should format a message with title, message, and fields', () => {
      const prompt: ConversationPromptDto = {
        title: 'User Profile',
        message: 'Please fill in your details.',
        fields: [
          { key: 'name', label: 'Name', required: true },
          { key: 'email', label: 'Email', required: false, type: 'text' },
        ],
      };
      const expected = [
        'User Profile',
        '',
        'Please fill in your details.',
        '',
        'Please provide:',
        '- Name (required) [text]',
        '- Email [text]',
      ].join('\n');
      expect(formatPromptMessage(prompt)).toBe(expected);
    });

    it('should handle only a message', () => {
      const prompt: ConversationPromptDto = { message: 'Just a message.' };
      expect(formatPromptMessage(prompt)).toBe('Just a message.');
    });

    it('should handle only fields', () => {
      const prompt: ConversationPromptDto = {
        fields: [{ key: 'pass', label: 'Password', required: true, type: 'password' }],
      };
      const expected = 'Please provide:\n- Password (required) [password]';
      expect(formatPromptMessage(prompt)).toBe(expected);
    });

    it('should return an empty string for a completely empty prompt', () => {
      const prompt: ConversationPromptDto = {};
      expect(formatPromptMessage(prompt)).toBe('');
    });
  });

  describe('renderBackendPrompt', () => {
    const mockBot = {
      sendMessage: vi.fn(),
    } as unknown as TelegramBot;
    const chatId = 12345;

    it('should send a message with formatted text and no keyboard if no options', async () => {
      const prompt: ConversationPromptDto = { title: 'Title', message: 'Message' };
      await renderBackendPrompt(prompt, mockBot, chatId);

      expect(mockBot.sendMessage).toHaveBeenCalledWith(chatId, 'Title\n\nMessage', undefined);
    });

    it('should send a message with formatted text and an inline keyboard for options', async () => {
      const prompt: ConversationPromptDto = {
        title: 'Choose one',
        selectionName: 'goal_id',
        options: [
          { label: 'Option 1', value: 'opt1' },
          { label: 'Option 2', value: 'opt2' },
        ],
      };

      const expectedText = 'Choose one';
      const expectedMarkup: TelegramBot.SendMessageOptions = {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Option 1', callback_data: 'convo:select:goal_id:opt1' }],
            [{ text: 'Option 2', callback_data: 'convo:select:goal_id:opt2' }],
          ],
        },
      };

      await renderBackendPrompt(prompt, mockBot, chatId);

      expect(mockBot.sendMessage).toHaveBeenCalledWith(chatId, expectedText, expectedMarkup);
    });

    it('should use a default selectionName if not provided', async () => {
      const prompt: ConversationPromptDto = {
        title: 'Choose',
        options: [{ label: 'A', value: 'valA' }],
      };

      const expectedMarkup: TelegramBot.SendMessageOptions = {
        reply_markup: {
          inline_keyboard: [[{ text: 'A', callback_data: 'convo:select:selection:valA' }]],
        },
      };

      await renderBackendPrompt(prompt, mockBot, chatId);

      expect(mockBot.sendMessage).toHaveBeenCalledWith(chatId, 'Choose', expectedMarkup);
    });

    it('should handle empty options array by not sending a keyboard', async () => {
      const prompt: ConversationPromptDto = {
        title: 'No Options',
        options: [],
      };

      await renderBackendPrompt(prompt, mockBot, chatId);

      expect(mockBot.sendMessage).toHaveBeenCalledWith(chatId, 'No Options', undefined);
    });
  });
});
