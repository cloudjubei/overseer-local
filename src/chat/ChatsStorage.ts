import fs from 'fs/promises'
import path from 'path'
import chokidar from 'chokidar'
import IPC_HANDLER_KEYS from '../ipcHandlersKeys'
import { randomUUID } from 'crypto'
import { BrowserWindow } from 'electron'
import { Chat, ChatContext, ChatMessage, ChatSettings } from './ChatsManager'

async function pathExists(p: string) {
  try {
    await fs.stat(p)
    return true
  } catch {
    return false
  }
}

export default class ChatsStorage {
  private projectId: string
  private chatsDir: string
  private window: BrowserWindow
  private watcher: chokidar.FSWatcher | null
  private chats: Chat[]

  constructor(projectId: string, chatsDir: string, window: BrowserWindow) {
    this.projectId = projectId
    this.chatsDir = chatsDir
    this.window = window
    this.watcher = null
    this.chats = []
  }

  async init() {
    await this.__buildIndex()
    await this.__startWatcher()
  }

  private __getChatPath(context: ChatContext): string {
    if (context.featureId && context.storyId) {
      return path.join(this.chatsDir, context.storyId, `${context.featureId}.json`)
    } else if (context.storyId) {
      return path.join(this.chatsDir, `${context.storyId}.json`)
    } else if (context.type === 'tests') {
      return path.join(this.chatsDir, 'tests.json')
    } else if (context.type === 'agents') {
      return path.join(this.chatsDir, 'agents.json')
    }
    return path.join(this.chatsDir, 'project.json')
  }

  async __startWatcher() {
    if (this.watcher) this.stopWatching()
    if (!(await pathExists(this.chatsDir))) return
    this.watcher = chokidar.watch(path.join(this.chatsDir, '**/*.json'), {
      ignored: /(^|[\/\\])\../,
      persistent: true,
      ignoreInitial: true,
    })
    this.watcher
      .on('add', (p) => this.__rebuildAndNotify(`File added: ${p}`))
      .on('change', (p) => this.__rebuildAndNotify(`File changed: ${p}`))
      .on('unlink', (p) => this.__rebuildAndNotify(`File removed: ${p}`))
  }

  stopWatching() {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
  }

  private __notify(msg?: string) {
    if (msg) console.log(msg)
    if (this.window) {
      this.window.webContents.send(IPC_HANDLER_KEYS.CHATS_SUBSCRIBE, this.chats)
    }
  }

  private async __rebuildAndNotify(msg?: string) {
    await this.__buildIndex()
    this.__notify(msg)
  }

  private async __readChat(filePath: string): Promise<Chat | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(content) as Chat
    } catch (err) {
      return null
    }
  }

  private async __buildIndex() {
    const chats: Chat[] = []
    const readDirRecursive = async (dir: string) => {
      try {
        if (!(await pathExists(dir))) return
        const entries = await fs.readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)
          if (entry.isDirectory()) {
            await readDirRecursive(fullPath)
          } else if (entry.isFile() && entry.name.endsWith('.json')) {
            const chat = await this.__readChat(fullPath)
            if (chat) {
              chats.push(chat)
            }
          }
        }
      } catch (err) {
        console.error(`Error building chat index for dir ${dir}:`, err)
      }
    }

    await readDirRecursive(this.chatsDir)
    this.chats = chats
  }

  async listChats(): Promise<Chat[]> {
    return this.chats
  }

  async getChat(context: ChatContext): Promise<Chat | undefined> {
    const chatPath = this.__getChatPath(context)
    return this.__readChat(chatPath).then((chat) => chat || undefined)
  }

  async createChat(context: ChatContext): Promise<Chat> {
    const chatId = randomUUID() // This is now more of an internal ID
    const chatPath = this.__getChatPath(context)

    await fs.mkdir(path.dirname(chatPath), { recursive: true })

    const newChat: Chat = {
      id: chatId,
      messages: [],
      creationDate: new Date().toISOString(),
      updateDate: new Date().toISOString(),
      settings: {},
      context,
    }

    await fs.writeFile(chatPath, JSON.stringify(newChat, null, 2), 'utf-8')
    this.chats.push(newChat)
    await this.__notify(`New chat for context ${JSON.stringify(context)} added.`)
    return newChat
  }

  async saveChat(
    context: ChatContext,
    messages: ChatMessage[],
    rawResponses: any[],
    settings: ChatSettings,
  ): Promise<{ ok: true }> {
    const chatPath = this.__getChatPath(context)
    let chatData: Partial<Chat> = {}
    try {
      const raw = await fs.readFile(chatPath, 'utf-8')
      chatData = JSON.parse(raw)
    } catch (e) {
      // File might not exist yet, that's okay, we'll create it.
    }

    const next: Chat = {
      ...chatData,
      id: chatData.id || randomUUID(),
      messages,
      rawResponses,
      settings,
      updateDate: new Date().toISOString(),
      creationDate: chatData.creationDate || new Date().toISOString(),
      context,
    }

    await fs.mkdir(path.dirname(chatPath), { recursive: true })
    await fs.writeFile(chatPath, JSON.stringify(next, null, 2), 'utf-8')

    const chatIndex = this.chats.findIndex((c) => c.id === next.id)
    if (chatIndex !== -1) {
      this.chats[chatIndex] = next
    } else {
      this.chats.push(next)
    }

    await this.__notify(`Chat for context ${JSON.stringify(context)} saved.`)
    return { ok: true }
  }

  async deleteChat(context: ChatContext): Promise<{ ok: true }> {
    const chatPath = this.__getChatPath(context)
    const chat = await this.getChat(context)
    try {
      await fs.rm(chatPath, { force: true })
    } catch (e: any) {
      throw new Error(`Could not delete chat file for context ${JSON.stringify(context)}: ${e.message}`)
    }

    if (chat) {
      this.chats = this.chats.filter((c) => c.id !== chat.id)
    }

    await this.__notify(`Chat for context ${JSON.stringify(context)} deleted.`)
    return { ok: true }
  }
}
