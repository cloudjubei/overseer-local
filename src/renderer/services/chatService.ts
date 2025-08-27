import { ChatMessage, LLMConfig } from '../types';

export type ChatService = {
  getCompletion: (messages: ChatMessage[], config: LLMConfig) => Promise<ChatMessage>;
  listModels: (config: LLMConfig) => Promise<string[]>;
  list: () => Promise<string[]>;
  create: () => Promise<string>;
  load: (chatId: string) => Promise<ChatMessage[]>;
  save: (chatId: string, messages: ChatMessage[]) => Promise<void>;
  delete: (chatId: string) => Promise<void>;
  setContext: (projectId: 'main' | string) => Promise<string[]>;
};

export const chatService: ChatService = {
  getCompletion: (messages, config) => window.chat.getCompletion(messages, config),
  listModels: (config) => window.chat.listModels(config),
  list: () => window.chat.list(),
  create: () => window.chat.create(),
  load: (chatId) => window.chat.load(chatId),
  save: (chatId, messages) => window.chat.save(chatId, messages),
  delete: (chatId) => window.chat.delete(chatId),
  setContext: (projectId) => window.chat.setContext(projectId),
};
