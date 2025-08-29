import { ChatMessage, LLMConfig } from '../types';

export type ChatsService = {
  getCompletion: (messages: ChatMessage[], config: LLMConfig) => Promise<ChatMessage>;
  listModels: (config: LLMConfig) => Promise<string[]>;
  list: () => Promise<string[]>;
  create: () => Promise<string>;
  load: (chatId: string) => Promise<ChatMessage[]>;
  save: (chatId: string, messages: ChatMessage[]) => Promise<void>;
  delete: (chatId: string) => Promise<void>;
  setContext: (projectId: 'main' | string) => Promise<string[]>;
};

export const chatsService: ChatsService = { ...window.chatsService } as any;
