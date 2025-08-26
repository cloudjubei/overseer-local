import React, { useState, useRef, useEffect } from 'react';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

const ChatView = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messageListRef = useRef<HTMLDivElement>(null);

  const [apiBaseUrl, setApiBaseUrl] = useState('https://api.openai.com/v1');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gpt-4o');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempApiBaseUrl, setTempApiBaseUrl] = useState('');
  const [tempApiKey, setTempApiKey] = useState('');
  const [tempModel, setTempModel] = useState('');

  const ipcRenderer = (window as any).electron.ipcRenderer;

  useEffect(() => {
    setApiBaseUrl(localStorage.getItem('llm_apiBaseUrl') || 'https://api.openai.com/v1');
    setApiKey(localStorage.getItem('llm_apiKey') || '');
    setModel(localStorage.getItem('llm_model') || 'gpt-4o');
  }, []);

  useEffect(() => {
    if (isSettingsOpen) {
      setTempApiBaseUrl(apiBaseUrl);
      setTempApiKey(apiKey);
      setTempModel(model);
    }
  }, [isSettingsOpen, apiBaseUrl, apiKey, model]);

  const handleSave = () => {
    setApiBaseUrl(tempApiBaseUrl);
    setApiKey(tempApiKey);
    setModel(tempModel);
    localStorage.setItem('llm_apiBaseUrl', tempApiBaseUrl);
    localStorage.setItem('llm_apiKey', tempApiKey);
    localStorage.setItem('llm_model', tempModel);
    setIsSettingsOpen(false);
  };

  const handleSend = async () => {
    const content = input.trim();
    if (!content) return;
    const newMessages = [...messages, { role: 'user', content }];
    setMessages(newMessages);
    setInput('');
    if (!apiKey) {
      setMessages([...newMessages, { role: 'assistant', content: 'LLM not configured. Please set your API key in settings.' }]);
      return;
    }
    setIsLoading(true);
    try {
      const response = await ipcRenderer.invoke('chat:completion', { messages: newMessages, config: { apiBaseUrl, apiKey, model } });
      setMessages([...newMessages, response]);
    } catch (err) {
      setMessages([...newMessages, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Project Chat</h1>
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="px-4 py-2 bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 rounded-md hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
        >
          Settings
        </button>
      </div>
      {!apiKey && (
        <div className="text-red-500 mb-4">
          Warning: LLM not configured. Please set your API key in settings.
        </div>
      )}
      <div
        ref={messageListRef}
        className="flex-1 overflow-y-auto mb-4 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 rounded-md"
        id="message-list"
      >
        {messages.map((msg, index) => (
          <div key={index} className={`mb-2 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
            <span className={`inline-block p-2 rounded-lg ${msg.role === 'user' ? 'bg-blue-100 dark:bg-blue-800' : 'bg-gray-100 dark:bg-gray-800'} text-neutral-900 dark:text-neutral-100`}>
              {msg.content}
            </span>
          </div>
        ))}
        {isLoading && (
          <div className="mb-2 text-left">
            <span className="inline-block p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-neutral-900 dark:text-neutral-100">
              Loading...
            </span>
          </div>
        )}
      </div>
      <div className="flex">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-2 rounded-md text-neutral-900 dark:text-neutral-100"
          placeholder="Type your message..."
          rows={3}
        ></textarea>
        <button
          onClick={handleSend}
          className="ml-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
        >
          Send
        </button>
      </div>
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-neutral-800 p-6 rounded-lg w-96">
            <h2 className="text-xl font-bold mb-4 text-neutral-900 dark:text-neutral-100">LLM Configuration</h2>
            <div className="mb-4">
              <label className="block mb-1 text-neutral-900 dark:text-neutral-100">API Base URL</label>
              <input
                type="text"
                value={tempApiBaseUrl}
                onChange={(e) => setTempApiBaseUrl(e.target.value)}
                className="w-full p-2 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 rounded-md"
              />
            </div>
            <div className="mb-4">
              <label className="block mb-1 text-neutral-900 dark:text-neutral-100">API Key</label>
              <input
                type="password"
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
                className="w-full p-2 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 rounded-md"
              />
            </div>
            <div className="mb-4">
              <label className="block mb-1 text-neutral-900 dark:text-neutral-100">Model</label>
              <input
                type="text"
                value={tempModel}
                onChange={(e) => setTempModel(e.target.value)}
                className="w-full p-2 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 rounded-md"
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="mr-2 px-4 py-2 bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 rounded-md hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatView;
