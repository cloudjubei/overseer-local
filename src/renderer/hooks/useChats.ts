import { useCallback, useEffect, useState } from 'react';
import { ChatMessage, chatsService } from '../services/chatsService';
import { filesService } from '../services/filesService';

export function useChats() {
  const [chatHistories, setChatHistories] = useState<string[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    (async () => {
      const chats = await chatsService.list();
      setChatHistories(chats);
      if (chats.length > 0) setCurrentChatId(chats[0]);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!currentChatId) return;
      const saved = await chatsService.load(currentChatId);
      setMessages(saved || []);
    })();
  }, [currentChatId]);

  const createChat = useCallback(async () => {
    const newChatId = await chatsService.create();
    setChatHistories((prev) => [...prev, newChatId]);
    setCurrentChatId(newChatId);
    setMessages([]);
    return newChatId;
  }, []);

  const deleteChat = useCallback(async (chatId: string) => {
    await chatsService.delete(chatId);
    setChatHistories((prev) => prev.filter((id) => id !== chatId));
    setMessages((prev) => prev);
    setCurrentChatId((prev) => {
      if (prev === chatId) {
        const next = chatHistories.filter((id) => id !== chatId);
        return next[0] || null;
      }
      return prev;
    });
  }, [chatHistories]);

  const sendMessage = useCallback(async (input: string, config: LLMConfig) => {
    if (!input.trim() || !currentChatId) return;
    const newMessages = [...messages, { role: 'user' as const, content: input }];
    setMessages(newMessages);

    const loadingMsg: ChatMessage = { role: 'assistant', content: 'Thinking...' };
    setMessages([...newMessages, loadingMsg]);

    try {
      const response = await chatsService.getCompletion(newMessages, config);
      const assistantMsg: ChatMessage = { role: 'assistant', content: response.content, model: config.model };
      const final = [...newMessages, assistantMsg];
      setMessages(final);
      await chatsService.save(currentChatId, final);
    } catch (error: any) {
      const errorMsg: ChatMessage = { role: 'assistant', content: `Error: ${error?.message || String(error)}` };
      setMessages([...newMessages, errorMsg]);
    }
  }, [messages, currentChatId]);

  const uploadDocument = useCallback(async (name: string, content: string) => {
    if (!currentChatId) return;
    try {
      const returnedPath = await filesService.upload(name, content);
      const uploadMsg: ChatMessage = { role: 'user', content: `Uploaded file to @${returnedPath}` };
      setMessages((prev) => {
        const next = [...prev, uploadMsg];
        chatsService.save(currentChatId, next);
        return next;
      });
    } catch (err: any) {
      const errorMsg: ChatMessage = { role: 'assistant', content: `Upload failed: ${err.message}` };
      setMessages((prev) => {
        const next = [...prev, errorMsg];
        chatsService.save(currentChatId, next);
        return next;
      });
    }
  }, [currentChatId]);

  const saveMessages = useCallback(async () => {
    if (!currentChatId) return;
    await chatsService.save(currentChatId, messages);
  }, [currentChatId, messages]);

  return {
    chatHistories,
    currentChatId,
    setCurrentChatId,
    messages,
    setMessages,
    createChat,
    deleteChat,
    sendMessage,
    uploadDocument,
    saveMessages,
  };
}
