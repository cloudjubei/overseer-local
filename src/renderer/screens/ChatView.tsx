import React, { useState, useEffect, useRef } from 'react';
import { LLMConfigManager } from '../utils/LLMConfigManager';
import {Modal} from '../components/ui/modal';

const ChatView = () => {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState({ apiBaseUrl: '', apiKey: '', model: '' });
  const [isConfigured, setIsConfigured] = useState(false);
  const managerRef = useRef<LLMConfigManager | null>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const [docsList, setDocsList] = useState<string[]>([]);
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false);
  const [matchingDocs, setMatchingDocs] = useState<string[]>([]);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [autocompletePosition, setAutocompletePosition] = useState<{left: number, top: number} | null>(null);

  useEffect(() => {
    managerRef.current = new LLMConfigManager();
    const loadedConfig = managerRef.current.getConfig();
    setConfig(loadedConfig);
    setIsConfigured(managerRef.current.isConfigured());

    const loadMessages = async () => {
      const saved = await window.chat.load();
      setMessages(saved || []);
    };
    loadMessages();
  }, []);

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
    if (!input.trim() || !isConfigured) return;

    const newMessages = [...messages, { role: 'user', content: input }];
    setMessages(newMessages);
    setInput('');

    const loadingMsg = { role: 'assistant', content: 'Thinking...' };
    setMessages([...newMessages, loadingMsg]);

    try {
      const response = await window.chat.getCompletion(newMessages, config);
      const assistantMsg = { role: 'assistant', content: response };
      setMessages([...newMessages, assistantMsg]);
      await window.chat.save([...newMessages, assistantMsg]);
    } catch (error) {
      const errorMsg = { role: 'assistant', content: `Error: ${error.message}` };
      setMessages([...newMessages, errorMsg]);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div ref={mirrorRef} aria-hidden="true" className="absolute top-[-9999px] left-0 overflow-hidden whitespace-pre-wrap break-words pointer-events-none" />
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
      <div
        ref={messageListRef}
        className="flex-1 overflow-y-auto mb-4 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 rounded-md"
      >
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
      <div className="flex relative">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
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
