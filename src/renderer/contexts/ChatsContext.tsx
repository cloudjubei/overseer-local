import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { chatsService, Chat, ChatContext as ChatContextType, ChatMessage } from '../services/chatsService';
import { LLMConfig } from 'thefactory-tools';
import { useActiveProject } from './ProjectContext';

interface ChatsContextValue {
  chat: Chat | undefined;
  isThinking: boolean;
  sendMessage: (message: string, config: LLMConfig, attachments?: string[]) => Promise<any>;
  updateChat: () => Promise<void>;
}

const ChatsContext = createContext<ChatsContextValue | undefined>(undefined);

function parseContextId(contextId: string): ChatContextType {
  const [projectId, storyId, featureId] = contextId.split('/');
  if (featureId) return { projectId, storyId, featureId };
  if (storyId) return { projectId, storyId };
  if (projectId.includes('@')) {
    const [id, type] = projectId.split('@') as [string, 'tests' | 'agents' | 'project'];
    return { projectId: id, type };
  }
  return { projectId };
}

export const ChatsProvider: React.FC<{ contextId: string; children: React.ReactNode }> = ({ contextId, children }) => {
  const { project } = useActiveProject();
  const [chat, setChat] = useState<Chat | undefined>(undefined);
  const [isThinking, setIsThinking] = useState(false);

  const chatContext = useMemo(() => parseContextId(contextId), [contextId]);

  const updateChat = useCallback(async () => {
    if (!project) return;
    try {
      const existingChat = await chatsService.getChat(chatContext);
      setChat(existingChat);
    } catch (error) {
      console.error('Failed to get chat:', error);
      const newChat = await chatsService.createChat(chatContext);
      setChat(newChat);
    }
  }, [project, chatContext]);

  useEffect(() => {
    updateChat();
    // No subscription available for single chat, so we poll or update manually.
  }, [updateChat]);

  const sendMessage = async (message: string, config: LLMConfig, attachments?: string[]): Promise<any> => {
    if (!project) return { ok: false };

    const newMessages: ChatMessage[] = [{
      role: 'user',
      content: message,
      attachments: attachments && attachments.length ? attachments : undefined,
    }];

    setChat(prev => prev ? { ...prev, messages: [...(prev.messages || []), ...newMessages] } : undefined);

    setIsThinking(true);
    try {
      const result = await chatsService.getCompletion(chatContext, newMessages, config);
      await updateChat();
      return result;
    } finally {
      setIsThinking(false);
    }
  };

  const value = {
    chat,
    isThinking,
    sendMessage,
    updateChat
  };

  return <ChatsContext.Provider value={value}>{children}</ChatsContext.Provider>;
};

export const useChatsContext = (): ChatsContextValue => {
  const context = useContext(ChatsContext);
  if (context === undefined) {
    throw new Error('useChatsContext must be used within a ChatsProvider');
  }
  return context;
};
