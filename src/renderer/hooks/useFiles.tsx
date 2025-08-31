import { useEffect, useMemo, useState } from 'react';
import { filesService, FileMeta } from '../services/filesService';
import { useActiveProject } from '../projects/ProjectContext';

export type DirNode = {
  name: string;
  relPath: string; // '' for docs root
  // absPath: string;
  dirs: DirNode[];
  files: FileMeta[];
};

function buildDirTree(files: FileMeta[]): DirNode {
  const root: DirNode = { name: '', relPath: '', dirs: [], files: [] };
  const dirMap = new Map<string, DirNode>();
  dirMap.set('', root);

  function ensureDir(relPath: string): DirNode {
    const existing = dirMap.get(relPath);
    if (existing) return existing;
    const parts = relPath.split('/').filter(Boolean);
    const name = parts[parts.length - 1] || '';
    const parentPath = parts.slice(0, -1).join('/');
    const parent = ensureDir(parentPath);
    const node: DirNode = { name, relPath, dirs: [], files: [] };
    parent.dirs.push(node);
    dirMap.set(relPath, node);
    return node;
  }

  for (const f of files) {
    const path = f.path || f.name;
    const parts = path.split('/');
    const fileName = parts.pop() || f.name;
    const dirPath = parts.join('/');
    const dirNode = ensureDir(dirPath);
    // Normalize name
    const meta: FileMeta = { ...f, name: fileName };
    dirNode.files.push(meta);
  }

  // Sort directories and files
  const sortTree = (node: DirNode) => {
    node.dirs.sort((a, b) => a.name.localeCompare(b.name));
    node.files.sort((a, b) => a.name.localeCompare(b.name));
    node.dirs.forEach(sortTree);
  };
  sortTree(root);

  return root;
}

export default function useFiles() {
  const {
    project
  } = useActiveProject()
  
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [directoryTree, setDirectoryTree] = useState<DirNode | null>(null)

  const updateCurrentFiles = async () => {
    if (project){
      const files = await filesService.listFiles(project)
      setFiles(files)
      const newTree = buildDirTree(files)
      setDirectoryTree(newTree)
    }
  }
  
  useEffect(() => {
    updateCurrentFiles();

    const unsubscribe = filesService.subscribe(updateCurrentFiles);

    return () => {
      unsubscribe();
    };
  }, []);

  const readFile = async (path: string) : Promise<string | undefined> =>  {
    if (project){
      return await filesService.readFile(project, path)
    }
    return undefined
  }
  const saveFile = async (path: string, content: string) : Promise<void> =>  {
    if (project){
      await filesService.writeFile(project, path, content)
    }
  }

  const getFileByPath = (path: string) : FileMeta | undefined => {
    for(const f of files){
      if (f.path == path){
        return f
      }
    }
  }

  return { files, directoryTree, readFile, saveFile, getFileByPath } as const;
}
  
const textExts = new Set([
  'txt','md','mdx','json','js','jsx','ts','tsx','css','scss','less','html','htm','xml','yml','yaml','csv','log','sh','bash','zsh','bat','ps1','py','rb','java','kt','go','rs','c','h','cpp','hpp','m','swift','ini','conf','env'
]);

export function isLikelyText(meta: FileMeta): boolean {
  if (meta.ext && textExts.has(meta.ext)) return true;
  if (meta.type) {
    if (meta.type.startsWith('text/')) return true;
    if (meta.type.includes('json') || meta.type.includes('xml')) return true;
  }
  // small files are likely safe to attempt text read
  return meta.size > 0 && meta.size < 2 * 1024 * 1024; // <2MB
}

export function guessLanguageFromExt(ext?: string): string | undefined {
  switch ((ext || '').toLowerCase()) {
    case 'ts': return 'typescript';
    case 'tsx': return 'tsx';
    case 'js': return 'javascript';
    case 'jsx': return 'jsx';
    case 'json': return 'json';
    case 'css': return 'css';
    case 'scss': return 'scss';
    case 'less': return 'less';
    case 'html':
    case 'htm': return 'html';
    case 'xml': return 'xml';
    case 'yml':
    case 'yaml': return 'yaml';
    case 'md':
    case 'mdx': return 'markdown';
    case 'py': return 'python';
    case 'rb': return 'ruby';
    case 'java': return 'java';
    case 'kt': return 'kotlin';
    case 'go': return 'go';
    case 'rs': return 'rust';
    case 'c':
    case 'h': return 'c';
    case 'cpp':
    case 'hpp': return 'cpp';
    case 'sh':
    case 'bash':
    case 'zsh': return 'shell';
    default: return undefined;
  }
}
export function inferFileType(pathOrName: string): string {
  const i = pathOrName.lastIndexOf('.');
  if (i > 0 && i < pathOrName.length - 1) return pathOrName.slice(i + 1).toLowerCase();
  return 'unknown';
}
