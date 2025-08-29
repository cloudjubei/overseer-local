import { useFilesIndex } from './useFilesIndex';

// Backwards-compatible shim. Prefer useFilesIndex in new code.
export function useDocsIndex() {
  const { snapshot, filesList } = useFilesIndex();
  return { snapshot, docsList: filesList };
}
