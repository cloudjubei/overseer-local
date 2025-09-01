import { useEffect, useState } from 'react';
import { chatsService } from '../services/chatsService';
import { useActiveProject } from '../projects/ProjectContext';
import { Chat, ChatMessage, LLMConfig } from '../services/chatsService';
import { ServiceResult } from '../services/serviceResult';

export function useChats() {
  const { project } = useActiveProject();

  const [chatsById, setChatsById] = useState<Record<string, Chat>>({});

  const update = async () => {
    if (project) {
      const chats = await chatsService.listChats(project);
      setChatsById(chats.reduce((acc, c) => {
        acc[c.id] = c;
        return acc;
      }, {} as Record<string, Chat>));
    }
  };

  useEffect(() => {
    update();

    const unsubscribe = chatsService.subscribe((chats) => {
      setChatsById(chats.reduce((acc, c) => {
        acc[c.id] = c;
        return acc;
      }, {} as Record<string, Chat>));
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    update();
  }, [project]);

  const createChat = async (): Promise<ServiceResult & { id?: string }> => {
    if (project) {
      return await chatsService.createChat(project);
    }
    return { ok: false };
  };

  const saveChat = async (chatId: string, messages: ChatMessage[]): Promise<ServiceResult> => {
    if (project) {
      return await chatsService.saveChat(project, chatId, messages);
    }
    return { ok: false };
  };

  const deleteChat = async (chatId: string): Promise<ServiceResult> => {
    if (project) {
      return await chatsService.deleteChat(project, chatId);
    }
    return { ok: false };
  };

  const getCompletion = async (messages: ChatMessage[], config: LLMConfig): Promise<ChatMessage> => {
    return await chatsService.getCompletion(messages, config);
  };

  const listModels = async (config: LLMConfig): Promise<string[]> => {
    return await chatsService.listModels(config);
  };

  return { chatsById, createChat, saveChat, deleteChat, getCompletion, listModels };
}
