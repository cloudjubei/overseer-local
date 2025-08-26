import React, { useRef, useState } from 'react';
import { Modal } from '../components/ui/modal';
import { useChats } from '../hooks/useChats';
import { useDocsIndex } from '../hooks/useDocsIndex';
import { useDocsAutocomplete } from '../hooks/useDocsAutocomplete';
import { useLLMConfig } from '../hooks/useLLMConfig';
import { docsService } from '../services/docsService';

const ChatView = () => {
  const { chatHistories, currentChatId, setCurrentChatId, messages, setMessages, createChat, deleteChat, sendMessage } = useChats();
  const { snapshot: docsSnapshot, docsList } = useDocsIndex();
  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const { config, setConfig, isConfigured, save } = useLLMConfig();

  const messageListRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { isOpen: isAutocompleteOpen, matches: matchingDocs, position: autocompletePosition, onSelect: handleSelect } = useDocsAutocomplete({
    docsList,
    input,
    setInput,
    textareaRef,
    mirrorRef,
  });

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    save(config);
    setShowSettings(false);
  };

  const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig({ ...config, [e.target.name]: e.target.value });
  };

  const handleSend = async () => {
    if (!input.trim() || !isConfigured) return;
    await sendMessage(input, config);
    setInput('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentChatId) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const name = file.name;
      try {
        const returnedPath = await docsService.upload(name, content);
        const uploadMsg = { role: 'user' as const, content: `Uploaded document to @${returnedPath}` };
        const newMessages = [...messages, uploadMsg];
        setMessages(newMessages);
      } catch (err: any) {
        console.error('Upload failed:', err);
        const errorMsg = { role: 'system' as const, content: `Upload failed: ${err.message}` };
        const newMessages = [...messages, errorMsg];
        setMessages(newMessages);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex h-full min-h-0 min-w-0">
      <div className="flex h-full w-64 shrink-0 flex-col border-r border-neutral-200 p-4 dark:border-neutral-800">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Chats</h2>
          <button onClick={createChat} className="rounded bg-blue-500 px-2 py-1 text-white">New Chat</button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {chatHistories.map((id) => (
            <div key={id} className={`flex items-center justify-between p-2 ${currentChatId === id ? 'bg-neutral-200 dark:bg-neutral-700' : ''}`} onClick={() => setCurrentChatId(id)}>
              <span className="truncate">Chat {id}</span>
              <button onClick={(e) => { e.stopPropagation(); deleteChat(id); }} className="text-red-500">Delete</button>
            </div>
          ))}
        </div>
      </div>
      <div className="flex h-full min-w-0 flex-1 flex-col">
        <div ref={mirrorRef} aria-hidden="true" className="pointer-events-none absolute left-0 top-[-9999px] overflow-hidden whitespace-pre-wrap" />
        <div className="flex items-center justify-between p-4">
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Project Chat {currentChatId ? `(ID: ${currentChatId})` : ''}</h1>
          <button onClick={() => setShowSettings(true)} className="rounded-md bg-neutral-200 px-4 py-2 text-neutral-900 hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-600 transition-colors">Settings</button>
        </div>
        {!isConfigured && (
          <div className="mx-4 mb-4 rounded-md bg-yellow-100 p-2 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
            Warning: LLM not configured. Please set your API key in settings.
          </div>
        )}
        <div ref={messageListRef} className="mx-4 mb-4 flex-1 overflow-auto rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          {messages.length === 0 ? (
            <div className="mt-10 text-center text-neutral-500 dark:text-neutral-400">Start chatting about the project</div>
          ) : (
            messages.map((msg, index) => (
              <div key={index} className={`mb-2 flex ${msg.role === 'user' ? 'justify-end' : msg.role === 'system' ? 'justify-center' : 'justify-start'}`}>
                <div className={`max-w-xs rounded-lg px-4 py-2 ${msg.role === 'user' ? 'bg-blue-500 text-white dark:bg-blue-600' : msg.role === 'system' ? 'bg-gray-300 text-neutral-900 dark:bg-gray-700 dark:text-neutral-100' : 'bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100'}`}>
                  {msg.content}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="relative flex items-start p-4">
          <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)} className="flex-1 resize-none rounded-md border border-neutral-200 bg-white p-2 text-neutral-900 outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100" placeholder="Type your message..." rows={3}></textarea>
          <button onClick={() => fileInputRef.current?.click()} className="ml-2 rounded-md bg-gray-500 px-4 py-2 text-white transition-colors hover:bg-gray-600">Attach</button>
          <input type="file" accept=".md,.txt" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
          <button onClick={handleSend} className="ml-2 rounded-md bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600">Send</button>
          {isAutocompleteOpen && autocompletePosition && (
            <div className="absolute z-10 max-h-60 overflow-y-auto rounded-md border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-800" style={{ left: `${autocompletePosition.left}px`, top: `${autocompletePosition.top}px` }}>
              {matchingDocs.map((path, idx) => (
                <div key={idx} className="cursor-pointer px-4 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700" onClick={() => handleSelect(path)}>
                  {path}
                </div>
              ))}
            </div>
          )}
        </div>
        {showSettings && (
          <Modal onClose={() => setShowSettings(false)}>
            <h2 className="mb-4 text-xl font-bold">LLM Configuration</h2>
            <form onSubmit={handleSaveConfig}>
              <div className="mb-4">
                <label className="mb-1 block">API Base URL</label>
                <input type="text" name="apiBaseUrl" value={config.apiBaseUrl} onChange={handleConfigChange} className="w-full rounded border p-2" />
              </div>
              <div className="mb-4">
                <label className="mb-1 block">API Key</label>
                <input type="text" name="apiKey" value={config.apiKey} onChange={handleConfigChange} className="w-full rounded border p-2" />
              </div>
              <div className="mb-4">
                <label className="mb-1 block">Model</label>
                <input type="text" name="model" value={config.model} onChange={handleConfigChange} className="w-full rounded border p-2" />
              </div>
              <button type="submit" className="rounded bg-blue-500 px-4 py-2 text-white">Save</button>
            </form>
          </Modal>
        )}
      </div>
    </div>
  );
};

export default ChatView;
