import { ProjectSpec } from 'src/types/tasks';
import { ChatMessage, LLMConfig } from '../types';

export type ChatsService = {
  getCompletion: (messages: ChatMessage[], config: LLMConfig) => Promise<ChatMessage>;
  listModels: (config: LLMConfig) => Promise<string[]>;
  listChats: (project: ProjectSpec) => Promise<string[]>;
  createChat: (project: ProjectSpec) => Promise<string>;
  getChat: (project: ProjectSpec, chatId: string) => Promise<ChatMessage[]>;
  saveChat: (project: ProjectSpec, chatId: string, messages: ChatMessage[]) => Promise<void>;
  deleteChat: (project: ProjectSpec, chatId: string) => Promise<void>;
};

export const chatsService: ChatsService = { ...window.chatsService }
