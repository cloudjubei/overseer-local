import { useCallback, useEffect, useState } from 'react';
import { chatService } from '../services/chatService';
import type { ChatMessage, LLMConfig } from '../types';

export function useChats() {
  const [chatHistories, setChatHistories] = useState<string[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    (async () => {
      const chats = await chatService.list();
      setChatHistories(chats);
      if (chats.length > 0) setCurrentChatId(chats[0]);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!currentChatId) return;
      const saved = await chatService.load(currentChatId);
      setMessages(saved || []);
    })();
  }, [currentChatId]);

  const createChat = useCallback(async () => {
    const newChatId = await chatService.create();
    setChatHistories((prev) => [...prev, newChatId]);
    setCurrentChatId(newChatId);
    setMessages([]);
    return newChatId;
  }, []);

  const deleteChat = useCallback(async (chatId: string) => {
    await chatService.delete(chatId);
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
      const response = await chatService.getCompletion(newMessages, config);
      const assistantMsg: ChatMessage = { role: 'assistant', content: response };
      const final = [...newMessages, assistantMsg];
      setMessages(final);
      await chatService.save(currentChatId, final);
    } catch (error: any) {
      const errorMsg: ChatMessage = { role: 'assistant', content: `Error: ${error?.message || String(error)}` };
      setMessages([...newMessages, errorMsg]);
    }
  }, [messages, currentChatId]);

  const saveMessages = useCallback(async () => {
    if (!currentChatId) return;
    await chatService.save(currentChatId, messages);
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
    saveMessages,
  };
}
