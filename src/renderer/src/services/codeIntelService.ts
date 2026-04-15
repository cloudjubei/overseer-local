import type { CodeIntelDetectedEnvironment } from 'thefactory-tools'

export type CodeIntelService = {
  detectEnvironment: (dirPath: string) => Promise<CodeIntelDetectedEnvironment>
}

export const codeIntelService: CodeIntelService = { ...(window as any).codeIntelService }
