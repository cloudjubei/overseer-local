import path from 'path'
import AppSettings from '../settings/AppSettings'

// Central registry of what we consider code/config/document files.
// This is intentionally broad to cover typical project assets users want searchable.
const DEFAULT_CODE_EXTENSIONS = [
  // Web/TS/JS and configs
  'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'json', 'jsonc',
  // Markup and docs
  'md', 'mdx', 'txt', 'html', 'htm',
  // Styles
  'css', 'scss', 'sass', 'less', 'pcss',
  // Configs
  'yml', 'yaml', 'toml', 'ini', 'env', 'conf', 'cfg', 'properties',
  // Shell and scripts
  'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat',
  // Common programming languages
  'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift', 'm', 'mm', 'cpp', 'cc', 'c', 'h', 'hpp', 'cs', 'php',
  // Data and schemas
  'sql', 'prisma', 'graphql', 'gql', 'proto', 'csv', 'xml',
  // Build/tooling
  'gradle', 'mk', 'make', 'tsconfig', 'eslintrc', 'prettierrc'
]

// Some important files are code/config even without extensions or with special names
const CODE_FILE_BASENAMES = new Set([
  'Dockerfile',
  'docker-compose.yml',
  'Makefile',
  '.env', '.env.local', '.env.development', '.env.production',
  '.gitignore', '.gitattributes', '.gitmodules',
  '.prettierrc', '.prettierignore', '.eslintrc', '.eslintignore',
  '.npmrc', '.yarnrc', '.nvmrc',
  'tsconfig.json', 'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock',
  'README', 'LICENSE'
])

let _cachedExts = null
function getConfiguredCodeExtensions() {
  try {
    const settings = new AppSettings().get()
    const exts = settings?.fileTyping?.codeExtensions
    if (Array.isArray(exts) && exts.length) return exts.map(String)
  } catch (_) {
    // If settings aren't available yet or App isn't ready, silently fall back
  }
  return null
}

function getCodeExtensions() {
  if (_cachedExts) return _cachedExts
  const configured = getConfiguredCodeExtensions()
  const merged = configured ? [...new Set([...configured, ...DEFAULT_CODE_EXTENSIONS])] : DEFAULT_CODE_EXTENSIONS
  _cachedExts = merged
  return merged
}

function normalizeExt(ext, relPath) {
  if (ext) return String(ext).toLowerCase().replace(/^\./, '')
  if (relPath) {
    const base = path.basename(relPath)
    const idx = base.lastIndexOf('.')
    if (idx > 0) return base.slice(idx + 1).toLowerCase()
  }
  return ''
}

export function isCodeFile(ext, relPath) {
  const base = relPath ? path.basename(relPath) : ''
  if (base && CODE_FILE_BASENAMES.has(base)) return true

  const normalized = normalizeExt(ext, relPath)
  if (!normalized) return false

  return getCodeExtensions().includes(normalized)
}

export function classifyDocumentType(relPath) {
  // Attempt to use ext from relPath
  const base = path.basename(relPath || '')
  const idx = base.lastIndexOf('.')
  const ext = idx >= 0 ? base.slice(idx + 1) : ''
  return isCodeFile(ext, relPath) ? 'project_code' : 'project_file'
}

export function getDefaultCodeExtensions() {
  return [...DEFAULT_CODE_EXTENSIONS]
}
