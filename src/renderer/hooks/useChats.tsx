import { useEffect, useState } from 'react';
import { chatsService } from '../services/chatsService';
import { useActiveProject } from '../projects/ProjectContext';
import { Chat, ChatMessage, LLMConfig } from '../services/chatsService';
import { ServiceResult } from '../services/serviceResult';

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

  const createChat = async (): Promise<string | undefined> => {
    if (!project) return undefined;
    const res = await chatsService.createChat(project.id);

    // The main implementation may return { ok, id } or a full Chat
    const newChatId = (res as any)?.id as string | undefined;
    if (newChatId) {
      setCurrentChatId(newChatId);
    }

    // Ensure local state refreshes from storage
    update();

    return newChatId;
  };

  const deleteChat = async (chatId: string): Promise<ServiceResult> => {
    if (project) {
      const result = await chatsService.deleteChat(project.id, chatId);
      // Optimistic cleanup; storage watcher will also update
      setChatsById((prev) => {
        const next = { ...prev };
        delete next[chatId];
        return next;
      });
      if (currentChatId === chatId) setCurrentChatId(undefined);
      return result;
    }
    return { ok: false };
  };

  const sendMessage = async (
    message: string,
    config: LLMConfig,
    attachments?: string[]
  ): Promise<ServiceResult> => {
    if (!project) return { ok: false };

    let targetChatId = currentChatId;
    if (!targetChatId || !chatsById[targetChatId]) {
      const res = await chatsService.createChat(project.id);
      const newChatId = (res as any)?.id as string | undefined;
      if (!newChatId) return { ok: false };
      targetChatId = newChatId;
      setCurrentChatId(newChatId);
      // We'll rely on storage subscription to populate messages
    }

    const newMessages: ChatMessage[] = [
      { role: 'user', content: message, attachments: attachments && attachments.length ? attachments : undefined },
    ];

    // Optimistically reflect outgoing message
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
