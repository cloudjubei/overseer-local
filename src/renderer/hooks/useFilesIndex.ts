import { useEffect, useState } from 'react';
import { filesService, extractPathsFromIndexTree } from '../services/filesService';

export function useFilesIndex() {
  const [snapshot, setSnapshot] = useState<any>(null);
  const [filesList, setFilesList] = useState<string[]>([]);

  useEffect(() => {
    let unsub: null | (() => void) = null;
    (async () => {
      const idx = await filesService.get();
      setSnapshot(idx);
      setFilesList(extractPathsFromIndexTree(idx?.tree));
      unsub = filesService.subscribe((s: any) => {
        setSnapshot(s);
        setFilesList(extractPathsFromIndexTree(s?.tree));
      });
    })();
    return () => { if (typeof unsub === 'function') unsub(); };
  }, []);

  // Return both names for transitional compatibility
  return { snapshot, filesList, docsList: filesList } as const;
}
