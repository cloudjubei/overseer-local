import React from 'react';
import FileDisplay, { FileMeta } from './FileDisplay';
import useFiles from '../../hooks/useFiles';
import DependencyBullet from '../tasks/DependencyBullet';

// Renders text into rich content:
// - @file/path.ext mentions -> inline File chip with hover preview
// - #<uuid>(.<uuid>) task/feature references -> DependencyBullet
// In forms: keep raw text; use this component only for display contexts.

// UUID pattern used by tasks/features
const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';

// Combined tokenizer: captures @file mentions and #dependency tokens while preserving text
function tokenize(input: string): Array<{ type: 'text' | 'file' | 'dep'; value: string }>{
  const parts: Array<{ type: 'text' | 'file' | 'dep'; value: string }> = [];
  if (!input) return [{ type: 'text', value: '' }];

  const fileRe = /@([A-Za-z0-9_\-./]+\.[A-Za-z0-9]+)/g; // crude heuristic for file-like tokens
  const depRe = new RegExp(`#(${UUID})(?:\.(${UUID}))?`, 'g');

  // Merge matches by walking input once with both regexes
  type Match = { index: number; length: number; type: 'file' | 'dep'; value: string };
  const matches: Match[] = [];

  let m: RegExpExecArray | null;
  while ((m = fileRe.exec(input))) {
    matches.push({ index: m.index, length: m[0].length, type: 'file', value: m[1] });
  }
  while ((m = depRe.exec(input))) {
    matches.push({ index: m.index, length: m[0].length, type: 'dep', value: m[0].slice(1) /* drop leading # */ });
  }

  matches.sort((a, b) => a.index - b.index);

  let lastIndex = 0;
  for (const mt of matches) {
    const start = mt.index;
    const end = start + mt.length;
    if (start > lastIndex) parts.push({ type: 'text', value: input.slice(lastIndex, start) });
    parts.push({ type: mt.type, value: mt.type === 'dep' ? mt.value : mt.value });
    lastIndex = end;
  }
  if (lastIndex < input.length) parts.push({ type: 'text', value: input.slice(lastIndex) });
  return parts;
}

export function RichText({ text }: { text: string | null | undefined }) {
  const { filesByPath } = useFiles();
  const segments = React.useMemo(() => tokenize(text || ''), [text]);

  return (
    <>
      {segments.map((seg, idx) => {
        if (seg.type === 'text') return <React.Fragment key={idx}>{seg.value}</React.Fragment>;
        if (seg.type === 'dep') {
          return <DependencyBullet key={idx} dependency={seg.value} />;
        }
        // seg.type === 'file'
        const token = seg.value;
        let meta: FileMeta | null = null;
        try {
          const found = filesByPath[token];
          if (found) {
            meta = { name: found.name || token.split('/').pop() || token, path: found.path, size: found.size, mtime: found.mtime, type: found.type };
          } else {
            const short = token.split('/').pop() || token;
            const alt = filesByPath[short];
            if (alt) meta = { name: alt.name || short, path: alt.path, size: alt.size, mtime: alt.mtime, type: alt.type };
          }
        } catch (e) {
          // ignore
        }
        if (!meta) {
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

export default RichText;
