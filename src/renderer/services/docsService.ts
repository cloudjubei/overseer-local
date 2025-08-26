export type DocsIndexSnapshot = any;

export const docsService = {
  get: (): Promise<DocsIndexSnapshot> => window.docsIndex.get(),
  subscribe: (callback: (snapshot: DocsIndexSnapshot) => void) => window.docsIndex.subscribe(callback),
  getFile: (relPath: string) => window.docsIndex.getFile(relPath),
  saveFile: (relPath: string, content: string) => window.docsIndex.saveFile(relPath, content),
  upload: (name: string, content: string) => window.docsIndex.upload(name, content),
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
