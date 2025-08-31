import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MarkdownRenderer from '../MarkdownRenderer';

export type MarkdownEditorProps = {
  value: string;
  onChange?: (next: string) => void;
  onSave?: (next: string) => void;
  onCancel?: () => void;
  className?: string;
  fileRelPath?: string | null;
};

function useUnsavedGuard(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [enabled]);
}

export default function MarkdownEditor2({ value, onChange, onSave, onCancel, className, fileRelPath }: MarkdownEditorProps) {
  const [text, setText] = useState<string>(value || '');
  const [dirty, setDirty] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setText(value || '');
    setDirty(false);
  }, [value]);

  useUnsavedGuard(dirty);

  const emitChange = useCallback((next: string) => {
    setText(next);
    setDirty(true);
    if (onChange) onChange(next);
  }, [onChange]);

  const applyAtSelection = useCallback((wrapStart: string, wrapEnd: string = '', placeholder: string = '') => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    const before = text.slice(0, start);
    const selected = text.slice(start, end) || placeholder;
    const after = text.slice(end);
    const next = before + wrapStart + selected + wrapEnd + after;
    emitChange(next);
    // restore selection roughly around inserted area
    const cursor = before.length + wrapStart.length + selected.length + wrapEnd.length;
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(cursor, cursor);
    });
  }, [text, emitChange]);

  const insertLinePrefix = useCallback((prefix: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    const before = text.slice(0, start);
    const selected = text.slice(start, end);
    const after = text.slice(end);

    // operate on full selected lines
    const selStartLineIdx = before.lastIndexOf('\n') + 1;
    const selEndLineIdx = end + after.indexOf('\n'); // -1 if not found
    const fullEnd = selEndLineIdx >= end ? selEndLineIdx : text.length;
    const fullSel = text.slice(selStartLineIdx, fullEnd);
    const updated = fullSel
      .split('\n')
      .map((line) => (line.length ? `${prefix}${line}` : prefix.trimEnd()))
      .join('\n');

    const next = text.slice(0, selStartLineIdx) + updated + text.slice(fullEnd);
    emitChange(next);

    requestAnimationFrame(() => {
      ta.focus();
    });
  }, [text, emitChange]);

  const commands = useMemo(() => ([
    { label: 'B', title: 'Bold', onClick: () => applyAtSelection('**', '**', 'bold text') },
    { label: 'I', title: 'Italic', onClick: () => applyAtSelection('*', '*', 'italic text') },
    { label: 'H1', title: 'Heading 1', onClick: () => insertLinePrefix('# ') },
    { label: 'H2', title: 'Heading 2', onClick: () => insertLinePrefix('## ') },
    { label: 'H3', title: 'Heading 3', onClick: () => insertLinePrefix('### ') },
    { label: 'Link', title: 'Insert link', onClick: () => applyAtSelection('[', '](https://)', 'text') },
    { label: 'Code', title: 'Inline code', onClick: () => applyAtSelection('`', '`', 'code') },
    { label: 'Quote', title: 'Blockquote', onClick: () => insertLinePrefix('> ') },
    { label: 'UL', title: 'Bulleted list', onClick: () => insertLinePrefix('- ') },
    { label: 'OL', title: 'Numbered list', onClick: () => insertLinePrefix('1. ') },
    { label: 'HR', title: 'Horizontal rule', onClick: () => applyAtSelection('\n\n---\n\n') },
    { label: 'Table', title: 'Table', onClick: () => applyAtSelection('\n\n| Col1 | Col2 |\n| --- | --- |\n| Val1 | Val2 |\n\n') },
  ]), [applyAtSelection, insertLinePrefix]);

  const handleSave = useCallback(() => {
    if (onSave) onSave(text);
    setDirty(false);
  }, [text, onSave]);

  const handleCancel = useCallback(() => {
    if (dirty) {
      const ok = window.confirm('Discard unsaved changes?');
      if (!ok) return;
    }
    if (onCancel) onCancel();
  }, [dirty, onCancel]);

  // Ctrl/Cmd+S to save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSave]);

  return (
    <div className={`flex h-full min-h-[60vh] flex-col ${className || ''}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {commands.map((cmd) => (
            <button
              key={cmd.label}
              type="button"
              onClick={cmd.onClick}
              title={cmd.title}
              className="rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
            >
              {cmd.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {fileRelPath ? (
            <span className="truncate text-xs text-neutral-500 dark:text-neutral-400" title={fileRelPath}>{fileRelPath}</span>
          ) : null}
          <button
            type="button"
            onClick={handleCancel}
            className="rounded border border-neutral-200 px-3 py-1 text-sm text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            Save
          </button>
        </div>
      </div>
      <div className="grid h-full min-h-[40vh] grid-cols-2 gap-3">
        <div className="flex h-full flex-col">
          <textarea
            ref={textareaRef}
            className="h-full min-h-[40vh] w-full resize-none rounded border border-neutral-200 bg-white p-3 font-mono text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            value={text}
            onChange={(e) => emitChange(e.target.value)}
            spellCheck={false}
          />
        </div>
        <div className="h-full overflow-auto rounded border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-950">
          <MarkdownRenderer content={text} />
        </div>
      </div>
    </div>
  );
}
