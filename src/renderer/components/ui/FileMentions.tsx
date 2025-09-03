import React from 'react';
import FileDisplay, { FileMeta } from './FileDisplay';
import useFiles from '../../hooks/useFiles';

// Renders text with @Filepath mentions into inline chips with hoverable tooltip previews.
// In forms: keep raw text; use this component only for display contexts.

function splitMentions(input: string): Array<{ type: 'text' | 'file'; text: string }>{
  const parts: Array<{ type: 'text' | 'file'; text: string }> = [];
  if (!input) return [{ type: 'text', text: '' }];
  // Match @<non-space, non-punctuation block> allowing /, ., -, _ characters
  const re = /@([A-Za-z0-9_\-./]+\.[A-Za-z0-9]+)/g; // crude heuristic for file-like tokens
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input))) {
    const start = m.index;
    const end = start + m[0].length;
    if (start > lastIndex) parts.push({ type: 'text', text: input.slice(lastIndex, start) });
    parts.push({ type: 'file', text: m[1] });
    lastIndex = end;
  }
  if (lastIndex < input.length) parts.push({ type: 'text', text: input.slice(lastIndex) });
  return parts;
}

export function FileMentions({ text }: { text: string;  }) {
  const { filesByPath } = useFiles();
  const segments = React.useMemo(() => splitMentions(text || ''), [text]);

  return (
    <>
      {segments.map((seg, idx) => {
        if (seg.type === 'text') return <React.Fragment key={idx}>{seg.text}</React.Fragment>;
        // Try to resolve to project-relative path first, fallback to filename lookup
        const token = seg.text;
        let meta: FileMeta | null = null;
        try {
          const found = filesByPath[token];
          if (found) {
            meta = { name: found.name || token.split('/').pop() || token, path: found.path, size: found.size, mtime: found.mtime, type: found.type };
          } else {
            // Fallback to name-only search
            const short = token.split('/').pop() || token;
            const alt = filesByPath[short];
            if (alt) meta = { name: alt.name || short, path: alt.path, size: alt.size, mtime: alt.mtime, type: alt.type };
          }
        } catch (e) {
          // ignore
        }
        if (!meta) {
          // Render a simple chip-like span for unresolved file
          return (
            <span key={idx} className="file-mention file-mention--unresolved" title={`File not found: ${token}`}>@{token}</span>
          );
        }
        return (
          <span key={idx} className="inline-file-chip">
            <FileDisplay
              file={meta}
              density='compact'
              interactive={false}
              showPreviewOnHover={true}
              navigateOnClick={false}
              showMeta={false}
              className="inline"
            />
          </span>
        );
      })}
    </>
  );
}

export default FileMentions;
