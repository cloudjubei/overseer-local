import type { ProgrammingLanguage } from 'thefactory-tools'

const aliasMap: Record<string, ProgrammingLanguage> = {
  js: 'javascript',
  javascript: 'javascript',
  node: 'javascript',

  ts: 'typescript',
  typescript: 'typescript',

  py: 'python',
  python: 'python',

  java: 'java',

  golang: 'go',
  go: 'go',

  rb: 'ruby',
  ruby: 'ruby',

  php: 'php',

  'c#': 'csharp',
  csharp: 'csharp',
  'c-sharp': 'csharp',
  dotnet: 'csharp',
  '.net': 'csharp',

  'c++': 'cpp',
  cpp: 'cpp',

  rs: 'rust',
  rust: 'rust',

  kt: 'kotlin',
  kotlin: 'kotlin',

  swift: 'swift',
}

export function coerceLanguage(input: string): ProgrammingLanguage | 'other' | '' {
  const raw = (input ?? '').trim()
  if (!raw) return ''
  const key = raw.toLowerCase()
  return aliasMap[key] ?? 'other'
}
