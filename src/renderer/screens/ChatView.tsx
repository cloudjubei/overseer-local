import React, { useState, useEffect, useRef } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';
import { useChats } from '../hooks/useChats';
import { useDocsIndex } from '../hooks/useDocsIndex';
import { useDocsAutocomplete } from '../hooks/useDocsAutocomplete';
import { useLLMConfig } from '../hooks/useLLMConfig';
import { useNavigator } from '../navigation/Navigator';
import type { ChatMessage } from '../types';

const ChatView = () => {
  const { chatHistories, currentChatId, setCurrentChatId, messages, createChat, deleteChat, sendMessage, uploadDocument } = useChats();
  const { docsList } = useDocsIndex();
  const { configs, activeConfigId, activeConfig, isConfigured, setActive } = useLLMConfig();
  const { navigateView } = useNavigator();

  const [input, setInput] = useState<string>('');
  const messageListRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isOpen: isAutocompleteOpen, matches: matchingDocs, position: autocompletePosition, onSelect: onAutocompleteSelect } = useDocsAutocomplete({
    docsList,
    input,
    setInput,
    textareaRef,
    mirrorRef,
  });

  useEffect(() => {
    messageListRef.current?.scrollTo(0, messageListRef.current.scrollHeight);
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !activeConfig) return;
    if (!currentChatId) {
      await createChat();
    }
    sendMessage(input, activeConfig);
    setInput('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      uploadDocument(file.name, content);
    };
    reader.readAsText(file);
  };

  interface EnhancedMessage extends ChatMessage {
    showModel?: boolean;
  }

  const enhancedMessages: EnhancedMessage[] = messages.map((msg, index) => {
    let showModel = false;
    if (msg.role === 'assistant' && msg.model) {
      const prevAssistant = [...messages.slice(0, index)].reverse().find(m => m.role === 'assistant');
      showModel = !prevAssistant || prevAssistant.model !== msg.model;
    }
    return { ...msg, showModel };
  });

  return (
    <div className="flex h-full">
      <div className="w-1/4 border-r border-neutral-200 dark:border-neutral-800 p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Chats</h2>
          <button onClick={createChat} className="px-2 py-1 bg-blue-500 text-white rounded">New Chat</button>
        </div>
        {chatHistories.map((id) => (
          <div key={id} className={`flex justify-between items-center p-2 cursor-pointer ${currentChatId === id ? 'bg-neutral-200 dark:bg-neutral-700' : ''}`} onClick={() => setCurrentChatId(id)}>
            <span>Chat {id}</span>
            <button onClick={() => deleteChat(id)} className="text-red-500">Delete</button>
          </div>
        ))}
      </div>
      <div className="flex flex-col w-3/4 h-full">
        <div ref={mirrorRef} aria-hidden="true" className="absolute top-[-9999px] left-0 overflow-hidden whitespace-pre-wrap break-words pointer-events-none" />
        <div className="flex justify-between items-center p-4">
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Project Chat {currentChatId ? `(ID: ${currentChatId})` : ''}</h1>
          <div className="flex items-center">
            <Select value={activeConfigId || ''} onValueChange={setActive}>
              <SelectTrigger className="w-[180px] mr-2">
                <SelectValue placeholder="Select Model" />
              </SelectTrigger>
              <SelectContent>
                {configs.map((cfg) => (
                  <SelectItem key={cfg.id} value={cfg.id}>{cfg.name} ({cfg.model})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              onClick={() => navigateView('Settings')}
              className="px-4 py-2 bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 rounded-md hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
            >
              Settings
            </button>
          </div>
        </div>
        {!isConfigured && (
          <div className="bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 p-2 rounded-md mb-4 mx-4">
            Warning: LLM not configured. Please set your API key in settings.
          </div>
        )}
        <div
          ref={messageListRef}
          className="flex-1 overflow-y-auto mb-4 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 rounded-md mx-4"
        >
          {enhancedMessages.length === 0 ? (
            <div className="text-center text-neutral-500 dark:text-neutral-400 mt-10">
              Start chatting about the project
            </div>
          ) : (
            enhancedMessages.map((msg, index) => (
              <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : msg.role === 'system' ? 'justify-center' : 'justify-start'} mb-2`}>
                <div className={`max-w-xs px-4 py-2 rounded-lg ${msg.role === 'user' ? 'bg-blue-500 dark:bg-blue-600 text-white' : msg.role === 'system' ? 'bg-gray-300 dark:bg-gray-700 text-neutral-900 dark:text-neutral-100' : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100'}`}>
                  {msg.role === 'assistant' && msg.showModel && msg.model && <div className="text-xs text-gray-500">{msg.model}</div>}
                  {msg.content}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="flex relative items-start p-4">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-2 rounded-md text-neutral-900 dark:text-neutral-100"
            placeholder="Type your message..."
            rows={3}
          ></textarea>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="ml-2 px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
          >
            Attach
          </button>
          <input
            type="file"
            accept=".md,.txt"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
          <button
            onClick={handleSend}
            className="ml-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            Send
          </button>
          {isAutocompleteOpen && autocompletePosition && (
            <div
              className="absolute bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md shadow-lg max-h-60 overflow-y-auto z-10"
              style={{ left: `${autocompletePosition.left}px`, top: `${autocompletePosition.top}px` }}
            >
              {matchingDocs.map((path, idx) => (
                <div
                  key={idx}
                  className="px-4 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-pointer"
                  onClick={() => onAutocompleteSelect(path)}
                >
                  {path}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatView;
