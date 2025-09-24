import type { BrowserWindow } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import IPC_HANDLER_KEYS from '../ipcHandlersKeys'
import BaseManager from '../BaseManager'

export type ContextChatScope = 'tests' | 'agents'
export type ContextChatIdentifier = {
  projectId: string
  storyId?: string
  featureId?: string
  scope?: ContextChatScope
}

export type ContextChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
  model?: string
  attachments?: string[]
  error?: { message: string }
}

export type ContextChatData = {
  context: ContextChatIdentifier
  messages: ContextChatMessage[]
  settings?: any
  createdAt: string
  updatedAt: string
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.stat(p)
    return true
  } catch {
    return false
  }
}

export default class ContextChatsManager extends BaseManager {
  constructor(projectRoot: string, window: BrowserWindow) {
    super(projectRoot, window)
  }

  private getBaseDir(): string {
    return path.join(this.projectRoot, '.factory', 'chats')
  }

  private resolveFilePath(ctx: ContextChatIdentifier): { dir: string; file: string } {
    const base = this.getBaseDir()
    const { projectId, storyId, featureId, scope } = ctx || ({} as any)
    if (!projectId) throw new Error('projectId is required')

    // Project level scoped files (tests/agents)
    if (!storyId && !featureId && scope) {
      const dir = path.join(base, projectId)
      const file = path.join(dir, `${scope}.json`)
      return { dir, file }
    }

    // Feature-level file
    if (storyId && featureId) {
      const dir = path.join(base, projectId, storyId)
      const file = path.join(dir, `${featureId}.json`)
      return { dir, file }
    }

    // Story-level file
    if (storyId && !featureId && !scope) {
      const dir = path.join(base, projectId)
      const file = path.join(dir, `${storyId}.json`)
      return { dir, file }
    }

    // Project-level (default) file
    if (!storyId && !featureId && !scope) {
      const dir = base
      const file = path.join(dir, `${projectId}.json`)
      return { dir, file }
    }

    throw new Error('Invalid context provided for chat file path resolution')
  }

  private async readContextChatFile(ctx: ContextChatIdentifier): Promise<ContextChatData | undefined> {
    const { file } = this.resolveFilePath(ctx)
    if (!(await pathExists(file))) return undefined
    const raw = await fs.readFile(file, 'utf-8')
    try {
      const data = JSON.parse(raw)
      return data
    } catch (e: any) {
      throw new Error(`Failed to parse chat file: ${file}. ${e?.message || e}`)
    }
  }

  private async writeContextChatFile(ctx: ContextChatIdentifier, data: ContextChatData): Promise<void> {
    const { dir, file } = this.resolveFilePath(ctx)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf-8')
  }

  private createDefaultData(ctx: ContextChatIdentifier): ContextChatData {
    const now = new Date().toISOString()
    return { context: ctx, messages: [], createdAt: now, updatedAt: now }
  }

  async getContextChat(ctx: ContextChatIdentifier, createIfMissing = true): Promise<ContextChatData> {
    const existing = await this.readContextChatFile(ctx)
    if (existing) return existing

    if (!createIfMissing) throw new Error('Context chat not found')
    const data = this.createDefaultData(ctx)
    await this.writeContextChatFile(ctx, data)
    return data
  }

  async saveContextChat(
    ctx: ContextChatIdentifier,
    patch: Partial<Pick<ContextChatData, 'messages' | 'settings'>>,
  ): Promise<{ ok: true }> {
    const current = (await this.readContextChatFile(ctx)) ?? this.createDefaultData(ctx)
    const next: ContextChatData = {
      ...current,
      ...('messages' in patch ? { messages: patch.messages ?? [] } : {}),
      ...('settings' in patch ? { settings: patch.settings } : {}),
      updatedAt: new Date().toISOString(),
    }
    await this.writeContextChatFile(ctx, next)
    return { ok: true }
  }

  async deleteContextChat(ctx: ContextChatIdentifier): Promise<{ ok: true }> {
    const { file } = this.resolveFilePath(ctx)
    try {
      await fs.rm(file, { force: true })
    } catch (e: any) {
      throw new Error(`Failed to delete context chat file: ${file}. ${e?.message || e}`)
    }
    return { ok: true }
  }

  getHandlersAsync(): Record<string, (args: any) => Promise<any>> {
    const handlers: Record<string, (args: any) => Promise<any>> = {}

    handlers[IPC_HANDLER_KEYS.CONTEXT_CHATS_GET] = async ({ context, createIfMissing }) =>
      this.getContextChat(context, createIfMissing)

    handlers[IPC_HANDLER_KEYS.CONTEXT_CHATS_SAVE] = async ({ context, patch }) =>
      this.saveContextChat(context, patch)

    handlers[IPC_HANDLER_KEYS.CONTEXT_CHATS_DELETE] = async ({ context }) => this.deleteContextChat(context)

    return handlers
  }
}
