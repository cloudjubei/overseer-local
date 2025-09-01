import { useEffect, useState } from 'react';
import { chatsService } from '../services/chatsService';
import { useActiveProject } from '../projects/ProjectContext';
import { Chat, ChatMessage, LLMConfig } from '../services/chatsService';
import { ServiceResult } from '../services/serviceResult';
import { ProjectSpec } from 'src/types/tasks';

export function useChats() {
  const { project } = useActiveProject();

  const [chatsById, setChatsById] = useState<Record<string, Chat>>({});
  const [currentChatId, setCurrentChatId] = useState<string | undefined>()

  const update = async () => {
    if (project){
      const chats = await chatsService.listChats(project.id)
      updateCurrentProjectChats(chats)
    }
  }
  const updateCurrentProjectChats = (chats: Chat[]) => {
    const newChats = chats.reduce((acc, c) => {
      acc[c.id] = c;
      return acc;
    }, {} as Record<string, Chat>)
    setChatsById(newChats);
    if (!currentChatId || !chatsById[currentChatId]){
      setCurrentChatId(chats[0]?.id)
    }
  }
  useEffect(() => {
    update();

    const unsubscribe = chatsService.subscribe(updateCurrentProjectChats);

    return () => {
      unsubscribe();
    };
  }, []);
  useEffect(() => {
    update();
  }, [project]);

  const createChat = async (): Promise<Chat | undefined> => {
    if (project) {
      return await chatsService.createChat(project.id);
    }
  }

  const deleteChat = async (chatId: string): Promise<ServiceResult> => {
    if (project) {
      return await chatsService.deleteChat(project.id, chatId);
    }
    return { ok: false };
  };

  const sendMessage = async (message: string, config: LLMConfig): Promise<ServiceResult> => {
    if (project && currentChatId) {
      const newMessages: ChatMessage[] = [{ role: 'user', content: message }]
      const newChat = chatsById[currentChatId]
      const newChatsById = { ...chatsById }
      newChatsById[newChat.id] = { ...newChat, messages: [...newChat.messages, ...newMessages]}
      setChatsById(newChatsById)
      return await chatsService.getCompletion(project.id, currentChatId, newMessages, config);
    }
    return { ok: false };
  };

  const listModels = async (config: LLMConfig): Promise<string[]> => {
    return await chatsService.listModels(config);
  };

  return { currentChatId, setCurrentChatId, chatsById, createChat, deleteChat, sendMessage, listModels };
}
