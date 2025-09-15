// Utilities to classify file types for document ingestion

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

export function isCodeFile(ext, relPath) {
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

export function classifyDocumentType(ext, relPath) {
  return isCodeFile(ext, relPath) ? 'project_code' : 'project_file'
}
