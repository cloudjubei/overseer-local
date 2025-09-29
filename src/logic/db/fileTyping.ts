// Utilities to classify file types for document ingestion

import { FileMeta } from 'thefactory-tools'

const DEFAULT_CODE_EXTS = new Set([
  'js',
  'jsx',
  'ts',
  'tsx',
  'mjs',
  'cjs',
  'json',
  'md',
  'mdx',
  'yml',
  'yaml',
  'toml',
  'ini',
  'xml',
  'html',
  'css',
  'scss',
  'less',
  'sass',
  'pcss',
  'csv',
  'tsv',
  'txt',
  'env',
  'gitignore',
  'gitattributes',
  'eslintignore',
  'prettierignore',
  'editorconfig',
  'sh',
  'bash',
  'zsh',
  'ps1',
  'bat',
  'Dockerfile',
  'dockerignore',
  'make',
  'mk',
  'cmake',
  'gradle',
  'pom',
  'java',
  'kt',
  'go',
  'rs',
  'py',
  'rb',
  'php',
  'cs',
  'cpp',
  'c',
  'h',
  'hpp',
  'vue',
  'svelte',
])

export function isCodeFile(ext: string | undefined, relPath: string) {
  if (!ext) {
    // try derive from relPath basename
    const i = relPath?.lastIndexOf('.') ?? -1
    if (i > 0) ext = relPath.slice(i + 1).toLowerCase()
  }
  if (!ext) return false
  if (DEFAULT_CODE_EXTS.has(ext)) return true
  // Special names without extension treated as code/config
  const base = relPath?.split('/').pop()
  if (!base) return false
  const special = ['Dockerfile', 'Makefile']
  return special.includes(base)
}

export function classifyDocumentType(ext: string | undefined, relPath: string) {
  return isCodeFile(ext, relPath) ? 'project_code' : 'project_file'
}

// Heuristic to determine if a file is likely text (safe for general viewing)
const TEXT_EXTS = new Set<string>([
  'txt',
  'md',
  'mdx',
  'json',
  'js',
  'jsx',
  'ts',
  'tsx',
  'css',
  'scss',
  'less',
  'html',
  'htm',
  'xml',
  'yml',
  'yaml',
  'csv',
  'log',
  'sh',
  'bash',
  'zsh',
  'bat',
  'ps1',
  'py',
  'rb',
  'java',
  'kt',
  'go',
  'rs',
  'c',
  'h',
  'cpp',
  'hpp',
  'm',
  'swift',
  'ini',
  'conf',
  'env',
])

export function isLikelyText(meta: Pick<FileMeta, 'ext' | 'type' | 'size'>): boolean {
  const ext = (meta.ext || '').toLowerCase()
  if (ext && (TEXT_EXTS.has(ext) || DEFAULT_CODE_EXTS.has(ext))) return true
  const type = meta.type || ''
  if (type) {
    if (type.startsWith('text/')) return true
    const t = type.toLowerCase()
    if (t.includes('json') || t.includes('xml') || t.includes('markdown')) return true
  }
  // As a conservative fallback for viewers, small files may be attempted as text
  return meta.size > 0 && meta.size < 2 * 1024 * 1024 // <2MB
}

// Stricter check for ingestion: do NOT use size fallback; only known text types
export function isTextForIngestion(meta: Pick<FileMeta, 'ext' | 'type' | 'size'>): boolean {
  const ext = (meta.ext || '').toLowerCase()
  if (ext && (TEXT_EXTS.has(ext) || DEFAULT_CODE_EXTS.has(ext))) return true
  const type = meta.type || ''
  if (type) {
    if (type.startsWith('text/')) return true
    const t = type.toLowerCase()
    if (t.includes('json') || t.includes('xml') || t.includes('markdown')) return true
  }
  return false
}
