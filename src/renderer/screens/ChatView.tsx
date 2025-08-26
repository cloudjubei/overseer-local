import React, { useState, useEffect, useRef } from 'react';
import { LLMConfigManager } from '../utils/LLMConfigManager';
import Modal from '../components/ui/modal';

const ChatView = () => {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState({ apiBaseUrl: '', apiKey: '', model: '' });
  const [isConfigured, setIsConfigured] = useState(false);
  const managerRef = useRef<LLMConfigManager | null>(null);

  useEffect(() => {
    managerRef.current = new LLMConfigManager();
    const loadedConfig = managerRef.current.getConfig();
    setConfig(loadedConfig);
    setIsConfigured(managerRef.current.isConfigured());
  }, []);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    managerRef.current?.save(config);
    setIsConfigured(!!config.apiKey);
    setShowSettings(false);
  };

  const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig({ ...config, [e.target.name]: e.target.value });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Project Chat</h1>
        <button
          onClick={() => setShowSettings(true)}
          className="px-4 py-2 bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 rounded-md hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
        >
          Settings
        </button>
      </div>
      {!isConfigured && (
        <div className="bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 p-2 rounded-md mb-4">
          Warning: LLM not configured. Please set your API key in settings.
        </div>
      )}
      <div className="flex-1 overflow-y-auto mb-4 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 rounded-md" id="message-list">
        {messages.length === 0 ? (
          <div className="text-center text-neutral-500 dark:text-neutral-400 mt-10">
            Start chatting about the project
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-2`}>
              <div className={`max-w-xs px-4 py-2 rounded-lg ${msg.role === 'user' ? 'bg-blue-500 dark:bg-blue-600 text-white' : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100'}`}>
                {msg.content}
              </div>
            </div>
          ))
        )}
      </div>
      <div className="flex">
        <textarea
          className="flex-1 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-2 rounded-md text-neutral-900 dark:text-neutral-100"
          placeholder="Type your message..."
          rows={3}
        ></textarea>
        <button
          className="ml-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
        >
          Send
        </button>
      </div>
      {showSettings && (
        <Modal onClose={() => setShowSettings(false)}>
          <h2 className="text-xl font-bold mb-4">LLM Configuration</h2>
          <form onSubmit={handleSaveConfig}>
            <div className="mb-4">
              <label className="block mb-1">API Base URL</label>
              <input
                type="text"
                name="apiBaseUrl"
                value={config.apiBaseUrl}
                onChange={handleConfigChange}
                className="w-full border p-2 rounded"
              />
            </div>
            <div className="mb-4">
              <label className="block mb-1">API Key</label>
              <input
                type="text"
                name="apiKey"
                value={config.apiKey}
                onChange={handleConfigChange}
                className="w-full border p-2 rounded"
              />
            </div>
            <div className="mb-4">
              <label className="block mb-1">Model</label>
              <input
                type="text"
                name="model"
                value={config.model}
                onChange={handleConfigChange}
                className="w-full border p-2 rounded"
              />
            </div>
            <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded">
              Save
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default ChatView;
