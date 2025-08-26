import { useEffect, useState } from 'react';
import { docsService, extractPathsFromIndexTree } from '../services/docsService';

export function useDocsIndex() {
  const [snapshot, setSnapshot] = useState<any>(null);
  const [docsList, setDocsList] = useState<string[]>([]);

  useEffect(() => {
    let unsub: null | (() => void) = null;
    (async () => {
      const idx = await docsService.get();
      setSnapshot(idx);
      setDocsList(extractPathsFromIndexTree(idx?.tree));
      unsub = docsService.subscribe((s) => {
        setSnapshot(s);
        setDocsList(extractPathsFromIndexTree(s?.tree));
      });
    })();
    return () => { if (unsub) unsub(); };
  }, []);

  return { snapshot, docsList };
}
