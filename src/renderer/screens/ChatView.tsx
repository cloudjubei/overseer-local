import React, { useState, useEffect, useRef } from 'react';
import { LLMConfigManager, LLMConfig } from '../utils/LLMConfigManager';
import { Modal } from '../components/ui/modal';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

const ChatView = () => {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant' | 'system'; content: string; model?: string }[]>([]);
  const [input, setInput] = useState<string>('');
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [configs, setConfigs] = useState<LLMConfig[]>([]);
  const [activeConfigId, setActiveConfigId] = useState<string | null>(null);
  const [editingConfig, setEditingConfig] = useState<Partial<LLMConfig> | null>(null);
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const managerRef = useRef<LLMConfigManager | null>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docsList, setDocsList] = useState<string[]>([]);
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState<boolean>(false);
  const [matchingDocs, setMatchingDocs] = useState<string[]>([]);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [autocompletePosition, setAutocompletePosition] = useState<{left: number, top: number} | null>(null);
  const [chatHistories, setChatHistories] = useState<string[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  useEffect(() => {
    managerRef.current = new LLMConfigManager();
    const loadedConfigs = managerRef.current.getConfigs();
    setConfigs(loadedConfigs);
    const activeId = managerRef.current.getActiveId();
    setActiveConfigId(activeId);
    setIsConfigured(managerRef.current.isConfigured());

    const loadChats = async () => {
      const chats = await window.chat.list();
      setChatHistories(chats);
      if (chats.length > 0) {
        setCurrentChatId(chats[0]);
      }
    };
    loadChats();
  }, []);

  useEffect(() => {
    const loadMessages = async () => {
      if (currentChatId) {
        const saved = await window.chat.load(currentChatId);
        setMessages(saved || []);
      }
    };
    loadMessages();
  }, [currentChatId]);

  useEffect(() => {
    messageListRef.current?.scrollTo(0, messageListRef.current.scrollHeight);
  }, [messages]);

  useEffect(() => {
    const fetchDocs = async () => {
      const index = await window.docsIndex.get();
      updateDocsList(index);
    };
    fetchDocs();
    const unsubscribe = window.docsIndex.subscribe(updateDocsList);
    return unsubscribe;
  }, []);

  const updateDocsList = (index: any) => {
    const paths = extractPaths(index.tree);
    setDocsList(paths);
  };

  const extractPaths = (tree: any): string[] => {
    const paths: string[] = [];
    const recurse = (node: any) => {
      if (node.type === 'file') {
        paths.push(node.relPath);
      }
      if (node.dirs) node.dirs.forEach(recurse);
      if (node.files) node.files.forEach(recurse);
    };
    recurse(tree);
    return paths;
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const handleInputEvent = () => {
      const pos = textarea.selectionStart;
      const text = textarea.value;
      checkForMention(text, pos);
    };

    textarea.addEventListener('input', handleInputEvent);
    textarea.addEventListener('keyup', handleInputEvent);
    textarea.addEventListener('keydown', handleInputEvent);
    textarea.addEventListener('click', handleInputEvent);

    return () => {
      textarea.removeEventListener('input', handleInputEvent);
      textarea.removeEventListener('keyup', handleInputEvent);
      textarea.removeEventListener('keydown', handleInputEvent);
      textarea.removeEventListener('click', handleInputEvent);
    };
  }, [docsList]);

  const checkForMention = (text: string, pos: number) => {
    let start = pos;
    while (start > 0 && text[start - 1] !== ' ' && text[start - 1] !== '\n') {
      start--;
    }
    const word = text.slice(start, pos);
    if (word.startsWith('@')) {
      const query = word.slice(1);
      const matches = docsList.filter((p) => p.toLowerCase().includes(query.toLowerCase()));
      setMatchingDocs(matches);
      setMentionStart(start);
      if (matches.length > 0) {
        const textarea = textareaRef.current;
        const coords = getCursorCoordinates(textarea, pos);
        const textareaRect = textarea.getBoundingClientRect();
        const style = window.getComputedStyle(textarea);
        const lineHeight = parseFloat(style.lineHeight) || 20;
        const cursorLeft = textareaRect.left + coords.x;
        const cursorTop = textareaRect.top + coords.y + lineHeight;
        setAutocompletePosition({ left: cursorLeft, top: cursorTop });
        setIsAutocompleteOpen(true);
        return;
      }
    }
    setIsAutocompleteOpen(false);
  };

  const getCursorCoordinates = (textarea: HTMLTextAreaElement, pos: number): { x: number; y: number } => {
    const mirror = mirrorRef.current;
    if (!mirror) return { x: 0, y: 0 };

    const style = window.getComputedStyle(textarea);
    const stylesToCopy = [
      'boxSizing',
      'borderBottomWidth',
      'borderLeftWidth',
      'borderRightWidth',
      'borderTopWidth',
      'fontFamily',
      'fontSize',
      'fontStyle',
      'fontWeight',
      'letterSpacing',
      'lineHeight',
      'paddingBottom',
      'paddingLeft',
      'paddingRight',
      'paddingTop',
      'textDecoration',
      'textTransform',
      'width',
    ];
    stylesToCopy.forEach((key) => {
      mirror.style[key] = style[key];
    });
    mirror.style.overflowWrap = 'break-word';
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.wordBreak = 'break-word';
    mirror.style.height = 'auto';

    mirror.textContent = input.slice(0, pos);

    const marker = document.createElement('span');
    marker.style.display = 'inline-block';
    marker.style.width = '0';
    marker.textContent = '';
    mirror.appendChild(marker);

    const mirrorRect = mirror.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();

    const x = markerRect.left - mirrorRect.left;
    const y = markerRect.top - mirrorRect.top;

    mirror.textContent = '';

    return { x, y };
  };

  const handleSelect = (path: string) => {
    const textarea = textareaRef.current;
    if (!textarea || mentionStart === null) return;

    const currentText = textarea.value;
    const currentPos = textarea.selectionStart;
    const before = currentText.slice(0, mentionStart);
    const after = currentText.slice(currentPos);
    const newText = `${before}@${path}${after}`;
    setInput(newText);

    const newPos = before.length + 1 + path.length;
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newPos, newPos);
    }, 0);

    setIsAutocompleteOpen(false);
    setMentionStart(null);
  };

  const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditingConfig(prev => ({ ...prev, [name]: value }));
  };

  const handleProviderChange = (value: string) => {
    setEditingConfig(prev => ({ ...prev, provider: value as 'openai' | 'litellm' }));
  };

  const handleSaveConfig = () => {
    if (!editingConfig) return;
    if (isAddingNew) {
      const newConfig = managerRef.current?.addConfig(editingConfig as LLMConfig);
      if (newConfig) {
        setConfigs(managerRef.current?.getConfigs() || []);
        setActiveConfigId(newConfig.id);
      }
      setIsAddingNew(false);
    } else if (editingConfig.id) {
      managerRef.current?.updateConfig(editingConfig.id, editingConfig);
      setConfigs(managerRef.current?.getConfigs() || []);
    }
    setEditingConfig(null);
    setIsConfigured(managerRef.current?.isConfigured() || false);
  };

  const handleEditConfig = (config: LLMConfig) => {
    setEditingConfig(config);
    setIsAddingNew(false);
  };

  const handleAddNewConfig = () => {
    setEditingConfig({ name: '', provider: 'openai', apiBaseUrl: '', apiKey: '', model: '' });
    setIsAddingNew(true);
  };

  const handleDeleteConfig = (id: string) => {
    managerRef.current?.removeConfig(id);
    setConfigs(managerRef.current?.getConfigs() || []);
    setActiveConfigId(managerRef.current?.getActiveId() || null);
    if (editingConfig?.id === id) {
      setEditingConfig(null);
    }
  };

  const handleSetActive = (id: string) => {
    managerRef.current?.setActiveId(id);
    setActiveConfigId(id);
  };

  const handleSend = async () => {
    if (!input.trim() || !isConfigured || !currentChatId) return;

    const activeConfig = managerRef.current?.getActiveConfig();
    if (!activeConfig) return;

    const newMessages = [...messages, { role: 'user', content: input }];
    setMessages(newMessages);
    setInput('');

    const loadingMsg = { role: 'assistant', content: 'Thinking...' };
    setMessages([...newMessages, loadingMsg]);

    try {
      const response = await window.chat.getCompletion(newMessages, activeConfig);
      const assistantMsg = { role: 'assistant', content: response.content, model: activeConfig.model };
      setMessages([...newMessages, assistantMsg]);
      await window.chat.save(currentChatId, [...newMessages, assistantMsg]);
    } catch (error) {
      const errorMsg = { role: 'assistant', content: `Error: ${error.message}` };
      setMessages([...newMessages, errorMsg]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentChatId) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const name = file.name;
      try {
        const returnedPath = await window.docsIndex.upload(name, content);
        const uploadMsg = { role: 'user', content: `Uploaded document to @${returnedPath}` };
        const newMessages = [...messages, uploadMsg];
        setMessages(newMessages);
        await window.chat.save(currentChatId, newMessages);
      } catch (err) {
        console.error('Upload failed:', err);
        const errorMsg = { role: 'system', content: `Upload failed: ${err.message}` };
        const newMessages = [...messages, errorMsg];
        setMessages(newMessages);
        await window.chat.save(currentChatId, newMessages);
      }
    };
    reader.readAsText(file);
  };

  const handleCreateChat = async () => {
    const newChatId = await window.chat.create();
    setChatHistories([...chatHistories, newChatId]);
    setCurrentChatId(newChatId);
    setMessages([]);
  };

  const handleDeleteChat = async (chatId: string) => {
    await window.chat.delete(chatId);
    setChatHistories(chatHistories.filter(id => id !== chatId));
    if (currentChatId === chatId) {
      setCurrentChatId(chatHistories[0] || null);
      setMessages([]);
    }
  };

  return (
    <div className="flex h-full">
      <div className="w-1/4 border-r border-neutral-200 dark:border-neutral-800 p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Chats</h2>
          <button onClick={handleCreateChat} className="px-2 py-1 bg-blue-500 text-white rounded">New Chat</button>
        </div>
        {chatHistories.map((id) => (
          <div key={id} className={`flex justify-between items-center p-2 cursor-pointer ${currentChatId === id ? 'bg-neutral-200 dark:bg-neutral-700' : ''}`} onClick={() => setCurrentChatId(id)}>
            <span>Chat {id}</span>
            <button onClick={() => handleDeleteChat(id)} className="text-red-500">Delete</button>
          </div>
        ))}
      </div>
      <div className="flex flex-col w-3/4 h-full">
        <div ref={mirrorRef} aria-hidden="true" className="absolute top-[-9999px] left-0 overflow-hidden whitespace-pre-wrap break-words pointer-events-none" />
        <div className="flex justify-between items-center p-4">
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Project Chat {currentChatId ? `(ID: ${currentChatId})` : ''}</h1>
          <div className="flex items-center">
            <Select value={activeConfigId || ''} onValueChange={handleSetActive}>
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
              onClick={() => setShowSettings(true)}
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
          {messages.length === 0 ? (
            <div className="text-center text-neutral-500 dark:text-neutral-400 mt-10">
              Start chatting about the project
            </div>
          ) : (
            messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : msg.role === 'system' ? 'justify-center' : 'justify-start'} mb-2`}>
                <div className={`max-w-xs px-4 py-2 rounded-lg ${msg.role === 'user' ? 'bg-blue-500 dark:bg-blue-600 text-white' : msg.role === 'system' ? 'bg-gray-300 dark:bg-gray-700 text-neutral-900 dark:text-neutral-100' : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100'}`}>
                  {msg.role === 'assistant' && msg.model && <div className="text-xs text-gray-500">{msg.model}</div>}
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
                  onClick={() => handleSelect(path)}
                >
                  {path}
                </div>
              ))}
            </div>
          )}
        </div>
        <Modal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          title="LLM Configurations"
        >
          <div className="mb-4">
            <Button onClick={handleAddNewConfig}>Add New Config</Button>
          </div>
          {configs.map((cfg) => (
            <div key={cfg.id} className="mb-2 flex justify-between">
              <span>{cfg.name} ({cfg.model}) {activeConfigId === cfg.id ? '(Active)' : ''}</span>
              <div>
                <Button onClick={() => handleEditConfig(cfg)} variant="outline">Edit</Button>
                <Button onClick={() => handleDeleteConfig(cfg.id)} variant="destructive">Delete</Button>
                {activeConfigId !== cfg.id && <Button onClick={() => handleSetActive(cfg.id)}>Set Active</Button>}
              </div>
            </div>
          ))}
          {editingConfig && (
            <div className="mt-4">
              <Input
                placeholder="Name"
                name="name"
                value={editingConfig.name || ''}
                onChange={handleConfigChange}
                className="mb-2"
              />
              <Select value={editingConfig.provider || 'openai'} onValueChange={handleProviderChange}>
                <SelectTrigger className="mb-2">
                  <SelectValue placeholder="Provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="litellm">LiteLLM</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="API Base URL"
                name="apiBaseUrl"
                value={editingConfig.apiBaseUrl || ''}
                onChange={handleConfigChange}
                className="mb-2"
              />
              <Input
                placeholder="API Key"
                name="apiKey"
                value={editingConfig.apiKey || ''}
                onChange={handleConfigChange}
                className="mb-2"
              />
              <Input
                placeholder="Model"
                name="model"
                value={editingConfig.model || ''}
                onChange={handleConfigChange}
                className="mb-2"
              />
              <Button onClick={handleSaveConfig}>Save</Button>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
};

export default ChatView;
