import { confirmDiscardIfUnsaved } from './UnsavedChanges';

export function fileHash(path: string): string {
  const encoded = encodeURIComponent(path);
  return `#files/${encoded}`;
}

export async function goToFile(path: string, opts?: { confirmIfUnsaved?: boolean; confirmMessage?: string }): Promise<boolean> {
  const { confirmIfUnsaved = true, confirmMessage } = opts || {};
  if (confirmIfUnsaved) {
    const ok = await confirmDiscardIfUnsaved(confirmMessage);
    if (!ok) return false;
  }
  window.location.hash = fileHash(path);
  return true;
}

export function parseFileFromHash(hashRaw?: string): string | null {
  const raw = (hashRaw ?? window.location.hash).replace(/^#/, '');
  if (!raw) return null;
  const parts = raw.split('/');
  if (parts[0] !== 'files' && parts[0] !== 'documents') return null; // legacy compat
  if (!parts[1]) return null;
  try {
    return decodeURIComponent(parts.slice(1).join('/'));
  } catch {
    return parts.slice(1).join('/');
  }
}
