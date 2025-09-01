import { ProjectSpec } from 'src/types/tasks';

export type LLMProviderType = 'openai' | 'anthropic' | 'gemini' | 'xai' | 'local' | 'custom';
export type LLMConfig = {
  id: string,
  name: string,
  provider: LLMProviderType,
  apiBaseUrl: string,
  apiKey: string,
  model: string
};

export type ChatRole = 'user' | 'assistant' | 'system';
export type ChatMessage = { role: ChatRole, content: string, model?: string };
export type Chat = { id: string, messages: ChatMessage[] };

export type ChatsService = {
  getCompletion: (messages: ChatMessage[], config: LLMConfig) => Promise<ChatMessage>;
  listModels: (config: LLMConfig) => Promise<string[]>;
  subscribe: (callback: (chats: Chat[]) => void) => () => void
  listChats: (project: ProjectSpec) => Promise<Chat[]>;
  createChat: (project: ProjectSpec) => Promise<Chat>;
  getChat: (project: ProjectSpec, chatId: string) => Promise<Chat[]>;
  saveChat: (project: ProjectSpec, chatId: string, messages: ChatMessage[]) => Promise<void>;
  deleteChat: (project: ProjectSpec, chatId: string) => Promise<void>;
};

export const chatsService: ChatsService = { ...window.chatsService }
