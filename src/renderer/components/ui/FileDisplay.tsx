import React from 'react';
import Tooltip from './Tooltip';
import { filesService, inferFileType } from '../../services/filesService';

export type FileKind = 'file' | 'folder' | 'symlink' | 'unknown';

export interface FileMeta {
  id?: string;
  path?: string;
  name: string;
  size?: number | null; // bytes
  mtime?: number | string | Date | null; // epoch ms or ISO or Date
  type?: string | null; // mime or extension
  kind?: FileKind;
}

export interface FileDisplayProps {
  file: FileMeta;
  /**
   * Visual density preset.
   * - normal: larger, used in lists and cards
   * - compact: smaller padding, used in selectors and inline chips
   */
  density?: 'normal' | 'compact';
  /**
   * Whether to render as an interactive card (hover/press states)
   */
  interactive?: boolean;
  /**
   * Optional leading visual (icon/thumbnail). If not provided, a default icon will be rendered based on file type.
   */
  leadingVisual?: React.ReactNode;
  /**
   * Optional trailing area (e.g., actions, badges)
   */
  trailing?: React.ReactNode;
  /**
   * Whether to show the secondary metadata line (size, date, type)
   */
  showMeta?: boolean;
  /**
   * Override aria-label for accessibility when used as a button/link wrapper
   */
  ariaLabel?: string;
  /**
   * Called when the card is clicked (if interactive)
   */
  onClick?: (file: FileMeta, event: React.MouseEvent) => void;
  /**
   * Class name passthrough for external layout control
   */
  className?: string;
  /**
   * Show a small preview tooltip/card on hover.
   */
  showPreviewOnHover?: boolean;
  /**
   * Placement for the preview tooltip.
   */
  previewPlacement?: 'top' | 'bottom' | 'left' | 'right';
  /**
   * Delay for showing the preview (ms)
   */
  previewDelayMs?: number;
  /**
   * Data attributes passthrough
   */
  [dataAttr: `data-${string}`]: unknown;
}

function formatBytes(size?: number | null): string | null {
  if (size == null || Number.isNaN(size)) return null;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let s = size;
  let i = 0;
  while (s >= 1024 && i < units.length - 1) {
    s /= 1024;
    i++;
  }
  return `${s % 1 === 0 ? s.toFixed(0) : s.toFixed(1)} ${units[i]}`;
}

function formatDate(input?: number | string | Date | null): string | null {
  if (!input && input !== 0) return null;
  let d: Date;
  if (input instanceof Date) d = input;
  else if (typeof input === 'number') d = new Date(input);
  else d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  // Use locale but keep concise format
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function extFromTypeOrName(type?: string | null, name?: string): string | null {
  if (type) {
    // Try mime like 'text/markdown' -> 'markdown'
    const parts = type.split('/');
    if (parts.length === 2 && parts[1]) return parts[1];
  }
  if (name && name.includes('.')) {
    const ext = name.split('.').pop();
    if (ext) return ext.toLowerCase();
  }
  return null;
}

function defaultIconFor(file: FileMeta): React.ReactNode {
  const ext = extFromTypeOrName(file.type ?? undefined, file.name);
  const baseCls = 'fd-icon';
  const cls = `${baseCls} ${ext ? `${baseCls}--${ext}` : ''}`;
  // Simple SVG iconography based on ext; keep generic fallback
  return (
    <span className={cls} aria-hidden>
      <svg width="20" height="24" viewBox="0 0 20 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 1h9l5 5v17a0 0 0 0 1 0 0H3a0 0 0 0 1 0 0V1z" fill="var(--surface-2, #f5f6f8)" stroke="var(--border-subtle, #d9dbe1)"/>
        <path d="M12 1v5h5" fill="var(--surface-1, #fff)"/>
      </svg>
    </span>
  );
}

// Small preview card shown inside the tooltip overlay
const textLikeTypes = new Set(['markdown', 'text', 'json', 'yaml', 'yml', 'javascript', 'typescript', 'styles', 'css', 'md', 'txt']);

function isTextLike(file: FileMeta): boolean {
  const t = (file.type || inferFileType(file.path || file.name)).toString().toLowerCase();
  return textLikeTypes.has(t);
}

const MAX_PREVIEW_CHARS = 1200; // ~ a few paragraphs

function useFilePreviewContent(file: FileMeta) {
  const [state, setState] = React.useState<{ loading: boolean; error: string | null; text: string | null }>({ loading: false, error: null, text: null });
  React.useEffect(() => {
    let cancelled = false;
    const relPath = file.path; // convention: FileMeta.path is relPath within project scope
    if (!relPath || !isTextLike(file)) {
      setState((s) => ({ ...s, loading: false, text: null, error: null }));
      return;
    }
    setState({ loading: true, error: null, text: null });
    (async () => {
      try {
        const content = await filesService.getFile(relPath);
        if (cancelled) return;
        if (typeof content === 'string') {
          const snippet = content.slice(0, MAX_PREVIEW_CHARS);
          setState({ loading: false, error: null, text: snippet });
        } else {
          setState({ loading: false, error: null, text: null });
        }
      } catch (e: any) {
        if (!cancelled) setState({ loading: false, error: e?.message || String(e), text: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file.path, file.type, file.name]);
  return state;
}

function FilePreviewCard({ file }: { file: FileMeta }) {
  const sizeLabel = formatBytes(file.size ?? null);
  const dateLabel = formatDate(file.mtime ?? null);
  const typeLabel = (file.type || inferFileType(file.path || file.name)).toString();
  const relPath = file.path;
  const { loading, error, text } = useFilePreviewContent(file);

  return (
    <div className="file-preview-card">
      <div className="file-preview-card__header">
        <div className="file-preview-card__title" title={relPath || file.name}>{file.name}</div>
        <div className="file-preview-card__meta">
          {typeLabel}{sizeLabel ? ` • ${sizeLabel}` : ''}{dateLabel ? ` • ${dateLabel}` : ''}
        </div>
      </div>
      {relPath && (
        <div className="file-preview-card__path" title={relPath}>{relPath}</div>
      )}
      <div className="file-preview-card__body">
        {loading && <div className="file-preview-card__loading">Loading preview…</div>}
        {error && <div className="file-preview-card__error">{error}</div>}
        {!loading && !error && text && (
          <pre className="file-preview-card__pre"><code>{text}</code></pre>
        )}
        {!loading && !error && !text && (
          <div className="file-preview-card__empty">No preview available</div>
        )}
      </div>
    </div>
  );
}

export const FileDisplay: React.FC<FileDisplayProps> = ({
  file,
  density = 'normal',
  interactive = false,
  leadingVisual,
  trailing,
  showMeta = true,
  ariaLabel,
  onClick,
  className = '',
  showPreviewOnHover = false,
  previewPlacement = 'right',
  previewDelayMs = 300,
  ...dataAttrs
}) => {
  const sizeLabel = formatBytes(file.size ?? null);
  const dateLabel = formatDate(file.mtime ?? null);
  const ext = extFromTypeOrName(file.type ?? undefined, file.name);

  const metaParts: string[] = [];
  if (ext) metaParts.push(ext.toUpperCase());
  if (sizeLabel) metaParts.push(sizeLabel);
  if (dateLabel) metaParts.push(dateLabel);

  const meta = metaParts.join(' • ');

  const role = interactive ? 'button' : undefined;
  const tabIndex = interactive ? 0 : undefined;
  const aria = ariaLabel || `${file.name}${meta ? `, ${meta}` : ''}`;

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!interactive || !onClick) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(file, (e as unknown) as React.MouseEvent);
    }
  }

  const cls = [
    'file-display',
    density === 'compact' ? 'is-compact' : 'is-normal',
    interactive ? 'is-interactive' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <div
      className={cls}
      role={role}
      tabIndex={tabIndex}
      aria-label={aria}
      onKeyDown={handleKeyDown}
      onClick={interactive && onClick ? (e) => onClick(file, e) : undefined}
      {...(dataAttrs as Record<string, string>)}
    >
      <div className="fd-leading">{leadingVisual ?? defaultIconFor(file)}</div>
      <div className="fd-content">
        <div className="fd-name" title={file.path || file.name}>
          {file.name}
        </div>
        {showMeta && meta && <div className="fd-meta">{meta}</div>}
      </div>
      {trailing && <div className="fd-trailing">{trailing}</div>}
    </div>
  );

  if (!showPreviewOnHover) return content;

  return (
    <Tooltip content={<FilePreviewCard file={file} />} placement={previewPlacement} delayMs={previewDelayMs}>
      {content as React.ReactElement}
    </Tooltip>
  );
};

export default FileDisplay;
