export type FilesIndexSnapshot = any;

// Generic Files Service: prefers window.filesIndex (new) with fallback to window.docsIndex (legacy)
const filesApi = (window as any).filesIndex || (window as any).docsIndex;

export const filesService = {
  // Returns the full files index snapshot (tree + flat list and any metadata provided by main process)
  get: (): Promise<FilesIndexSnapshot> => filesApi.get(),
  // Subscribe to index updates; returns unsubscribe if provided by API or a noop
  subscribe: (callback: (snapshot: FilesIndexSnapshot) => void) => filesApi.subscribe(callback),
  // Read a file's textual content by its relPath within the indexed project scope
  getFile: (relPath: string) => filesApi.getFile(relPath),
  // Save textual content to a file at relPath (app specific semantics: overwrite or create)
  saveFile: (relPath: string, content: string) => filesApi.saveFile(relPath, content),
  // Upload a new file by name (placed under the index root according to main process policy)
  upload: (name: string, content: string) => filesApi.upload(name, content),
  // Set current project context (e.g., 'main' or a child project id)
  setContext: (projectId: 'main' | string) => filesApi.setContext(projectId),
};

export function extractPathsFromIndexTree(tree: any): string[] {
  const paths: string[] = [];
  const recurse = (node: any) => {
    if (!node) return;
    if (node.type === 'file' && node.relPath) {
      paths.push(node.relPath);
    }
    if (Array.isArray(node.dirs)) node.dirs.forEach(recurse);
    if (Array.isArray(node.files)) node.files.forEach(recurse);
  };
  recurse(tree);
  return paths;
}

// Optional helper: derive a basic file type label from name or relPath (extension based)
export function inferFileType(nameOrPath: string): string {
  const lower = (nameOrPath || '').toLowerCase();
  const ext = lower.split('.').pop() || '';
  switch (ext) {
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'txt':
      return 'text';
    case 'json':
      return 'json';
    case 'yml':
    case 'yaml':
      return 'yaml';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'css':
    case 'scss':
    case 'sass':
      return 'styles';
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
    case 'svg':
      return 'image';
    case 'pdf':
      return 'pdf';
    default:
      return ext || 'file';
  }
}
