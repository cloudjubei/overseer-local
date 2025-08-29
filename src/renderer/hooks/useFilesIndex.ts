import { useEffect, useMemo, useState } from 'react';
import filesService, { FilesIndex, FileMeta } from '../services/filesService';

export function useFilesIndex() {
  const [index, setIndex] = useState<FilesIndex>({ files: [], byPath: new Map(), updatedAt: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    filesService.getIndex().then((idx) => {
      if (!mounted) return;
      setIndex(idx);
      setLoading(false);
    });
    const unsub = filesService.subscribe((idx) => {
      setIndex({ ...idx, byPath: new Map(idx.byPath) });
    });
    return () => { mounted = false; unsub(); };
  }, []);

  const files = index.files;
  const byExt = useMemo(() => {
    const map = new Map<string, FileMeta[]>();
    for (const f of files) {
      const k = f.ext || '';
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(f);
    }
    return map;
  }, [files]);

  return { index, files, byExt, loading, refresh: filesService.refreshIndex } as const;
}

export default useFilesIndex;
