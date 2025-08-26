import { useEffect, useRef, useState } from 'react';

export function useDocsAutocomplete(params: {
  docsList: string[];
  input: string;
  setInput: (v: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  mirrorRef: React.RefObject<HTMLDivElement>;
}) {
  const { docsList, input, setInput, textareaRef, mirrorRef } = params;
  const [isOpen, setIsOpen] = useState(false);
  const [matches, setMatches] = useState<string[]>([]);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const handlersRef = useRef<{ handleEvent: () => void } | null>(null);

  function getCursorCoordinates(textarea: HTMLTextAreaElement, pos: number) {
    const mirror = mirrorRef.current;
    if (!mirror) return { x: 0, y: 0 };

    const style = window.getComputedStyle(textarea);
    const stylesToCopy = [
      'boxSizing','borderBottomWidth','borderLeftWidth','borderRightWidth','borderTopWidth','fontFamily','fontSize','fontStyle','fontWeight','letterSpacing','lineHeight','paddingBottom','paddingLeft','paddingRight','paddingTop','textDecoration','textTransform','width'
    ] as const;
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
  }

  const checkForMention = (text: string, pos: number) => {
    let start = pos;
    while (start > 0 && text[start - 1] !== ' ' && text[start - 1] !== '\n') {
      start--;
    }
    const word = text.slice(start, pos);
    if (word.startsWith('@')) {
      const query = word.slice(1);
      const filtered = docsList.filter((p) => p.toLowerCase().includes(query.toLowerCase()));
      setMatches(filtered);
      setMentionStart(start);
      if (filtered.length > 0) {
        const textarea = textareaRef.current!;
        const coords = getCursorCoordinates(textarea, pos);
        const textareaRect = textarea.getBoundingClientRect();
        const style = window.getComputedStyle(textarea);
        const lineHeight = parseFloat(style.lineHeight) || 20;
        const cursorLeft = textareaRect.left + coords.x;
        const cursorTop = textareaRect.top + coords.y + lineHeight;
        setPosition({ left: cursorLeft, top: cursorTop });
        setIsOpen(true);
        return;
      }
    }
    setIsOpen(false);
  };

  const onSelect = (path: string) => {
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
    setIsOpen(false);
    setMentionStart(null);
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const handleInputEvent = () => {
      const pos = textarea.selectionStart;
      const text = textarea.value;
      checkForMention(text, pos);
    };

    handlersRef.current = { handleEvent: handleInputEvent };

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
  }, [docsList, textareaRef.current]);

  return { isOpen, matches, position, onSelect };
}
