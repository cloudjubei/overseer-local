import React, { useState, useEffect, useRef } from 'react';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

const ChatView: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [docPaths, setDocPaths] = useState<string[]>([]);
  const [showAuto, setShowAuto] = useState(false);
  const [matchingPaths, setMatchingPaths] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [autoPosition, setAutoPosition] = useState({ top: 0, left: 0 });
  const [autoPrefix, setAutoPrefix] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const load = async () => {
      const snapshot = await window.docsIndex.get();
      setDocPaths(Object.keys(snapshot.filesByPath || {}).sort());
    };
    load();
    const unsubscribe = window.docsIndex.subscribe((snapshot) => {
      setDocPaths(Object.keys(snapshot.filesByPath || {}).sort());
    });
    return () => unsubscribe();
  }, []);

  const handleSend = () => {
    if (!inputValue.trim()) return;
    setMessages([...messages, { role: 'user', content: inputValue }]);
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showAuto) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, matchingPaths.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (matchingPaths[selectedIndex]) {
          selectPath(matchingPaths[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        setShowAuto(false);
      }
    } else {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputValue(value);
    const pos = e.target.selectionStart;
    const mention = findMention(value, pos);
    if (mention) {
      const query = mention.query.toLowerCase();
      const filtered = docPaths.filter((p) => p.toLowerCase().startsWith(query));
      if (filtered.length > 0) {
        setMatchingPaths(filtered);
        setAutoPrefix(mention.prefix);
        setSelectedIndex(0);
        setShowAuto(true);
        const coords = getCaretCoordinates(e.target, pos);
        setAutoPosition({
          top: e.target.offsetTop + coords.top + coords.height,
          left: e.target.offsetLeft + coords.left,
        });
      } else {
        setShowAuto(false);
      }
    } else {
      setShowAuto(false);
    }
  };

  const findMention = (text: string, pos: number) => {
    const before = text.slice(0, pos);
    const match = before.match(/@([^\s@]*)$/);
    if (match) {
      return { prefix: '@' + match[1], query: match[1] };
    }
    return null;
  };

  const selectPath = (path: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const start = pos - autoPrefix.length;
    const before = inputValue.slice(0, start);
    const after = inputValue.slice(pos);
    const newValue = `${before}@${path} ${after}`;
    setInputValue(newValue);
    setShowAuto(false);
    setTimeout(() => {
      ta.focus();
      const newPos = start + `@${path} `.length;
      ta.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const getCaretCoordinates = (element: HTMLTextAreaElement, position: number) => {
    const div = document.createElement('div');
    const style = getComputedStyle(element);
    const props = [
      'direction', 'boxSizing', 'width', 'height', 'overflowX', 'overflowY',
      'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
      'borderStyle', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize', 'fontSizeAdjust',
      'lineHeight', 'fontFamily', 'textAlign', 'textTransform', 'textIndent', 'textDecoration',
      'letterSpacing', 'wordSpacing', 'tabSize', 'MozTabSize'
    ];
    const isFirefox = !(window.mozInnerScreenX == null);
    div.id = 'input-textarea-caret-position-mirror-div';
    document.body.appendChild(div);
    const divStyle = div.style;
    divStyle.position = 'absolute';
    divStyle.left = '-9999px';
    divStyle.top = '-9999px';
    divStyle.zIndex = '-9999';
    divStyle.visibility = 'hidden';
    divStyle.whiteSpace = 'pre-wrap';
    divStyle.overflowWrap = 'break-word';
    divStyle.wordWrap = 'break-word';
    props.forEach(prop => {
      divStyle[prop] = style[prop];
    });
    if (isFirefox) {
      if (style['boxSizing'] === 'border-box') {
        divStyle.width = parseInt(style.width) - parseInt(style.paddingLeft) - parseInt(style.paddingRight) - parseInt(style.borderLeftWidth) - parseInt(style.borderRightWidth) + 'px';
      } else {
        divStyle.width = style.width;
      }
    } else {
      divStyle.width = style.width;
    }
    divStyle.height = style.height;
    divStyle.overflow = 'hidden';
    div.textContent = element.value.substring(0, position);
    const span = document.createElement('span');
    span.textContent = element.value.substring(position) || '.';
    div.appendChild(span);
    const coordinates = {
      top: span.offsetTop + parseInt(style['borderTopWidth']),
      left: span.offsetLeft + parseInt(style['borderLeftWidth']),
      height: span.offsetHeight
    };
    document.body.removeChild(div);
    return coordinates;
  };

  return (
    <div className="flex flex-col h-full p-4 bg-gray-100 relative">
      <div className="flex-1 overflow-y-auto mb-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-10">
            Start chatting about the project
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}
            >
              <div
                className={`max-w-xs px-4 py-2 rounded-lg ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-300 text-black'}`}
              >
                {msg.content}
              </div>
            </div>
          ))
        )}
      </div>
      <div className="flex items-center border-t border-gray-300 p-2 bg-white">
        <textarea
          ref={textareaRef}
          className="flex-1 p-2 border border-gray-300 rounded resize-none"
          rows={3}
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
        />
        <button className="ml-2 px-4 py-2 bg-blue-500 text-white rounded" onClick={handleSend}>
          Send
        </button>
      </div>
      {showAuto && (
        <div
          className="absolute bg-white border border-gray-300 shadow-lg z-10 max-h-40 overflow-y-auto"
          style={{ top: `${autoPosition.top}px`, left: `${autoPosition.left}px` }}
        >
          <ul>
            {matchingPaths.map((p, i) => (
              <li
                key={p}
                className={`px-4 py-2 cursor-pointer ${i === selectedIndex ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
                onClick={() => selectPath(p)}
              >
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ChatView;
