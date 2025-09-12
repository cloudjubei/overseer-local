import { useEffect, useMemo, useState } from 'react';
import { useTasks } from '../contexts/TasksContext';
import { useActiveProject } from '../contexts/ProjectContext';

type RefItem = {
  ref: string;
  display: string;
  title: string;
  type: 'task' | 'feature';
};

export function useReferencesAutocomplete(params: {
  input: string;
  setInput: (v: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  mirrorRef: React.RefObject<HTMLDivElement>;
}) {
  const { project } = useActiveProject();
  const { input, setInput, textareaRef, mirrorRef } = params;
  const { tasksById } = useTasks();

  const references = useMemo<RefItem[]>(() => {
    if (!project) {
      return []
    }
    const refs: RefItem[] = [];
    Object.values(tasksById).forEach((task) => {
      const taskDisplay = `${project.taskIdToDisplayIndex[task.id]}`
      refs.push({ ref: `${task.id}`, display: taskDisplay, title: task.title, type: 'task' });
      (task.features || []).forEach((f) => {
        const featureDisplay = `${task.featureIdToDisplayIndex[f.id]}`
        refs.push({ ref: `${task.id}.${f.id}`, display: `${taskDisplay}.${featureDisplay}`, title: f.title, type: 'feature' });
      });
    });
    return refs.sort((a, b) => a.ref.localeCompare(b.ref));
  }, [tasksById, project]);

  const [isOpen, setIsOpen] = useState(false);
  const [matches, setMatches] = useState<RefItem[]>([]);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const [caretPos, setCaretPos] = useState<number>(0);

  function getCursorCoordinates(textarea: HTMLTextAreaElement, pos: number) {
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
    ] as const;
    stylesToCopy.forEach((key) => {
      (mirror.style as any)[key] = (style as any)[key];
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
  }

  // Treat common punctuation and whitespace as boundaries, but allow '.' for display refs like 1.2
  const isBoundaryChar = (ch: string) => {
    return /[\s\n\t\(\)\[\]\{\}<>,!?:;\"'`]/.test(ch); // '.' intentionally excluded
  };

  const checkForMention = (text: string, pos: number) => {
    let start = pos;
    while (start > 0 && !isBoundaryChar(text[start - 1])) {
      start--;
    }
    const word = text.slice(start, pos);

    if (word.startsWith('#')) {
      const query = word.slice(1).toLowerCase();
      const filtered = references.filter(
        (item) => item.display.toLowerCase().startsWith(query) || item.title.toLowerCase().includes(query)
      );
      setMatches(filtered);
      setMentionStart(start);

      const textarea = textareaRef.current!;
      const coords = getCursorCoordinates(textarea, pos);
      const textareaRect = textarea.getBoundingClientRect();
      const cursorLeft = textareaRect.left + window.scrollX + coords.x;
      const topAboveTextarea = textareaRect.top + window.scrollY - 8;
      setPosition({ left: cursorLeft, top: topAboveTextarea });
      setIsOpen(true);
      return;
    }

    setIsOpen(false);
    setMentionStart(null);
  };

  // selectedRef should be the DISPLAY form (e.g., 3.2) so that the text shows as #3.2
  const onSelect = (selectedRefDisplay: string) => {
    const textarea = textareaRef.current;
    if (!textarea || mentionStart === null) return;
    const currentText = textarea.value;
    const currentPos = textarea.selectionStart;
    const before = currentText.slice(0, mentionStart);
    const after = currentText.slice(currentPos);
    // Insert display-based reference and add a trailing space for UX consistency
    const newText = `${before}#${selectedRefDisplay} ${after}`;
    setInput(newText);
    const newPos = before.length + 1 + selectedRefDisplay.length + 1; // include space
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
    setIsOpen(false);
    setMentionStart(null);
  };

  useEffect(() => {
    const handleSelectionChange = () => {
      const ta = textareaRef.current;
      if (!ta) return;
      if (document.activeElement === ta) {
        try {
          setCaretPos(ta.selectionStart ?? 0);
        } catch {
          // ignore
        }
      }
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [textareaRef]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const pos = textarea.selectionStart ?? caretPos;
    checkForMention(input, pos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, references, caretPos]);

  return { isOpen, matches, position, onSelect };
}
