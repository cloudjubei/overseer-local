import React, { useEffect, useMemo, useState } from 'react';
import { FileMeta } from '../../services/fileService';
import fileService from '../../services/fileService';
import { useUnsavedChanges } from '../../navigation/UnsavedChanges';

function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function basicMarkdownToHtml(md: string) {
  // Very minimal: headings, code blocks, inline code, bold, italic, links, paragraphs
  let html = escapeHtml(md);
  html = html.replace(/^######\s(.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s(.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s(.+)$/gm, '<h1>$1</h1>');
  // fenced code blocks ```
  html = html.replace(/```([\s\S]*?)```/g, (_, code) => `<pre class="md-code"><code>${code}</code></pre>`);
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\n\n+/g, '</p><p>');
  html = `<p>${html}</p>`;
  // links [text](url)
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  return html;
}

export type MarkdownEditorProps = {
  file: FileMeta;
};

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ file }) => {
  const [value, setValue] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saveSupported, setSaveSupported] = useState<boolean>(false);
  const [dirty, setDirty] = useState<boolean>(false);

  // Register unsaved changes checker for this editor instance
  useUnsavedChanges(`markdown:${file.path}`, () => dirty);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setDirty(false);
    fileService.readFileText(file.path).then((txt) => {
      if (!mounted) return;
      setValue(txt ?? '');
      setLoading(false);
    });
    const w = window as any;
    setSaveSupported(!!(w.api?.writeFile || w.writeFile || w.files?.writeFile));
    return () => { mounted = false; };
  }, [file.path]);

  async function handleSave() {
    const w = window as any;
    try {
      if (w.api?.writeFile) {
        await w.api.writeFile(file.path, value, 'utf8');
        setDirty(false);
        return;
      }
      if (w.writeFile) {
        await w.writeFile(file.path, value, 'utf8');
        setDirty(false);
        return;
      }
      if (w.files?.writeFile) {
        await w.files.writeFile(file.path, value, 'utf8');
        setDirty(false);
        return;
      }
      alert('Saving not supported in this environment');
    } catch (e) {
      console.error('Save failed', e);
      alert('Failed to save file');
    }
  }

  const previewHtml = useMemo(() => basicMarkdownToHtml(value || ''), [value]);

  return (
    <div className="md-editor" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
        <strong style={{ flex: 1 }}>{file.name}</strong>
        {saveSupported && (
          <button className="btn" disabled={!dirty} onClick={handleSave}>
            Save
          </button>
        )}
      </div>
      {loading ? (
        <div style={{ padding: 16 }}>Loading...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, flex: 1, minHeight: 0 }}>
          <div style={{ padding: 8, borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column' }}>
            <textarea
              value={value}
              onChange={(e) => { setValue(e.target.value); setDirty(true); }}
              style={{ flex: 1, resize: 'none', width: '100%', border: 'none', outline: 'none', fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)', fontSize: 13, lineHeight: 1.5 }}
              spellCheck={false}
            />
          </div>
          <div style={{ padding: 12, overflow: 'auto' }}>
            <div className="md-preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        </div>
      )}
    </div>
  );
};

export default MarkdownEditor;
