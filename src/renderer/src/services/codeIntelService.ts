import type { DetectedEnvironment } from 'thefactory-tools'

export type CodeIntelService = {
  detectEnvironment: (dirPath: string) => Promise<DetectedEnvironment>
}

export const codeIntelService: CodeIntelService = { ...(window as any).codeIntelService }
