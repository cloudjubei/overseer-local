import { useEffect, useState } from 'react';
import { chatsService } from '../services/chatsService';
import { useActiveProject } from '../projects/ProjectContext';
import { Chat, ChatMessage, LLMConfig } from '../services/chatsService';
import { ServiceResult } from '../services/serviceResult';
import { ProjectSpec } from 'src/types/tasks';

export function useChats() {
  const { project } = useActiveProject();

  const [chatsById, setChatsById] = useState<Record<string, Chat>>({});
  const [currentChatId, setCurrentChatId] = useState<string | undefined>();

  const update = async () => {
    if (project) {
      const chats = await chatsService.listChats(project.id);
      updateCurrentProjectChats(chats);
    }
  };

  const updateCurrentProjectChats = (chats: Chat[]) => {
    const newChats = chats.reduce((acc, c) => {
      acc[c.id] = c;
      return acc;
    }, {} as Record<string, Chat>);

    setChatsById(newChats);

    // If no current chat selected or it no longer exists, pick the most recently updated chat
    if (!currentChatId || !newChats[currentChatId]) {
      const mostRecent = chats
        .slice()
        .sort((a, b) => new Date(b.updateDate).getTime() - new Date(a.updateDate).getTime())[0];
      if (mostRecent) setCurrentChatId(mostRecent.id);
    }
  };

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
    if (!project) return undefined;
    const chat = await chatsService.createChat(project.id);
    if (chat) {
      // Optimistically add to local state and select it
      setChatsById((prev) => ({ ...prev, [chat.id]: chat }));
      setCurrentChatId(chat.id);
    }
    return chat;
  };

  const deleteChat = async (chatId: string): Promise<ServiceResult> => {
    if (project) {
      return await chatsService.deleteChat(project.id, chatId);
    }
    return { ok: false };
  };

  const sendMessage = async (message: string, config: LLMConfig): Promise<ServiceResult> => {
    if (!project) return { ok: false };

    let targetChatId = currentChatId;
    // If no chat selected, create one and select it
    if (!targetChatId || !chatsById[targetChatId]) {
      const newChat = await chatsService.createChat(project.id);
      if (!newChat) return { ok: false };
      targetChatId = newChat.id;
      setCurrentChatId(newChat.id);
      setChatsById((prev) => ({ ...prev, [newChat.id]: newChat }));
    }

    const newMessages: ChatMessage[] = [{ role: 'user', content: message }];
    setChatsById((prev) => {
      const existing = prev[targetChatId!];
      if (!existing) return prev;
      return {
        ...prev,
        [targetChatId!]: { ...existing, messages: [...existing.messages, ...newMessages] },
      };
    });

    return await chatsService.getCompletion(project.id, targetChatId!, newMessages, config);
  };

  const listModels = async (config: LLMConfig): Promise<string[]> => {
    return await chatsService.listModels(config);
  };

  return { currentChatId, setCurrentChatId, chatsById, createChat, deleteChat, sendMessage, listModels };
}
