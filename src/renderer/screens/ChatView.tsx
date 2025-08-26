import React, { useState, useEffect, useRef } from 'react';
import { LLMConfigManager } from '../utils/LLMConfigManager';
import {Modal} from '../components/ui/modal';

const ChatView = () => {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant' | 'system'; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState({ apiBaseUrl: '', apiKey: '', model: '' });
  const [isConfigured, setIsConfigured] = useState(false);
  const managerRef = useRef<LLMConfigManager | null>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docsList, setDocsList] = useState<string[]>([]);
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false);
  const [matchingDocs, setMatchingDocs] = useState<string[]>([]);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [autocompletePosition, setAutocompletePosition] = useState<{left: number, top: number} | null>(null);
  const [chatHistories, setChatHistories] = useState<string[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  useEffect(() => {
    managerRef.current = new LLMConfigManager();
    const loadedConfig = managerRef.current.getConfig();
    setConfig(loadedConfig);
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

  const updateDocsList = (index) => {
    const paths = extractPaths(index.tree);
    setDocsList(paths);
  };

  const extractPaths = (tree) => {
    const paths = [];
    const recurse = (node) => {
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

  const getCursorCoordinates = (textarea: HTMLTextAreaElement, pos: number) => {
    const mirror = mirrorRef.current;
    if (!mirror) return { x: 0, y: 0 };

    const style = window.getComputedStyle(textarea);
    const stylesToCopy = [
      'boxSizing', 'borderBottomWidth', 'borderLeftWidth', 'borderRightWidth', 'borderTopWidth', 'fontFamily', 'fontSize', 'fontStyle', 'fontWeight', 'letterSpacing', 'lineHeight', 'paddingBottom', 'paddingLeft', 'paddingRight', 'paddingTop', 'textDecoration', 'textTransform', 'width'
    ];
    stylesToCopy.forEach((key) => { (mirror.style as any)[key] = (style as any)[key]; });
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

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    managerRef.current?.save(config);
    setIsConfigured(!!config.apiKey);
    setShowSettings(false);
  };

  const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig({ ...config, [e.target.name]: e.target.value });
  };

  const handleSend = async () => {
    if (!input.trim() || !isConfigured || !currentChatId) return;

    const newMessages = [...messages, { role: 'user', content: input }];
    setMessages(newMessages);
    setInput('');

    const loadingMsg = { role: 'assistant', content: 'Thinking...' } as const;
    setMessages([...newMessages, loadingMsg]);

    try {
      const response = await window.chat.getCompletion(newMessages, config);
      const assistantMsg = { role: 'assistant', content: response } as const;
      setMessages([...newMessages, assistantMsg]);
      await window.chat.save(currentChatId, [...newMessages, assistantMsg]);
    } catch (error: any) {
      const errorMsg = { role: 'assistant', content: `Error: ${error.message}` } as const;
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
        const uploadMsg = { role: 'user', content: `Uploaded document to @${returnedPath}` } as const;
        const newMessages = [...messages, uploadMsg];
        setMessages(newMessages);
        await window.chat.save(currentChatId, newMessages);
      } catch (err: any) {
        console.error('Upload failed:', err);
        const errorMsg = { role: 'system', content: `Upload failed: ${err.message}` } as const;
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
    const next = chatHistories.filter(id => id !== chatId);
    setChatHistories(next);
    if (currentChatId === chatId) {
      setCurrentChatId(next[0] || null);
      setMessages([]);
    }
  };

  return (
    <div className="flex h-full min-h-0 min-w-0">
      <div className="flex h-full w-64 shrink-0 flex-col border-r border-neutral-200 p-4 dark:border-neutral-800">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Chats</h2>
          <button onClick={handleCreateChat} className="rounded bg-blue-500 px-2 py-1 text-white">New Chat</button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {chatHistories.map((id) => (
            <div key={id} className={`flex items-center justify-between p-2 ${currentChatId === id ? 'bg-neutral-200 dark:bg-neutral-700' : ''}`} onClick={() => setCurrentChatId(id)}>
              <span className="truncate">Chat {id}</span>
              <button onClick={(e) => { e.stopPropagation(); handleDeleteChat(id); }} className="text-red-500">Delete</button>
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
