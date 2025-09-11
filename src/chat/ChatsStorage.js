import fs from 'fs/promises';
import path from 'path';
import chokidar from 'chokidar';
import IPC_HANDLER_KEYS from "../ipcHandlersKeys";
import { randomUUID } from 'crypto';

async function pathExists(p) {
  try { await fs.stat(p); return true; } catch { return false; }
}

export default class ChatsStorage {
  constructor(projectId, chatsDir, window) {
    this.projectId = projectId;
    this.chatsDir = chatsDir;
    this.window = window;
    this.watcher = null;

    this.chats = []
  }

  async init() {
    await this.__buildIndex();
    await this.__startWatcher();
  }

  async __startWatcher() {
    if (this.watcher) this.stopWatching();
    if (!(await pathExists(this.chatsDir))) return;
    this.watcher = chokidar.watch(path.join(this.chatsDir, '*.json'), {
      ignored: /(^|[\/\\])\../,
      persistent: true,
      ignoreInitial: true,
    });
    this.watcher
      .on('add', (p) => this.__rebuildAndNotify(`File added: ${p}`))
      .on('change', (p) => this.__rebuildAndNotify(`File changed: ${p}`))
      .on('unlink', (p) => this.__rebuildAndNotify(`File removed: ${p}`));
  }

  stopWatching() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  __notify(msg) {
    if (msg) console.log(msg);
    if (this.window) {
      this.window.webContents.send(IPC_HANDLER_KEYS.CHATS_SUBSCRIBE, this.chats);
    }
  }
  async __rebuildAndNotify(msg) {
    await this.__buildIndex();
    this.__notify(msg)
  }

  async __buildIndex() {
    try {
      if (await pathExists(this.chatsDir)) {
        const chatFiles = await fs.readdir(this.chatsDir, { withFileTypes: true });
        const chats = [];
        for (const file of chatFiles) {
          if (file.isFile() && file.name.includes('.json')) {
            const chatFilePath = path.join(this.chatsDir, file.name);
            const content = await fs.readFile(chatFilePath, 'utf-8');
            try {
              const chat = JSON.parse(content);
              chats.push(chat);
            } catch (err) {
            }
          }
        }
        this.chats = chats
      }
    } catch (err) {
    }
  }

  async listChats() {
    return this.chats
  }

  async getChat(id) {
    return this.chats.find(c => c.id === id)
  }

  async createChat() {
    const chatId = randomUUID()

    await fs.mkdir(this.chatsDir, { recursive: true });

    const newChat = {
      id: chatId,
      messages: [],
      creationDate: new Date().toISOString(), 
      updateDate: new Date().toISOString()
    }

    const chatPath = path.join(this.chatsDir,`${chatId}.json`);
    await fs.writeFile(chatPath, JSON.stringify(newChat, null, 2), 'utf-8');
    this.chats.push(newChat)
    await this.__notify(`New chat ${chatId} added.`)
    return newChat
  }

  async saveChat(chatId, messages, rawResponses) {
    const chatPath = path.join(this.chatsDir,`${chatId}.json`);
    let chatData;
    try {
      const raw = await fs.readFile(chatPath, 'utf-8');
      chatData = JSON.parse(raw);
    } catch (e) {
      throw new Error(`Could not read or parse chat file for chat ${chatId}: ${e.message}`);
    }

    const next = { ...chatData, messages, rawResponses, updateDate: new Date().toISOString() };

    await fs.writeFile(chatPath, JSON.stringify(next, null, 2), 'utf-8');
    this.chats = this.chats.map(c => c.id === next.id ? next : c)

    await this.__notify(`Chat ${chatId} saved.`)
    return { ok: true };
  }

  async deleteChat(chatId) {
    const chatPath = path.join(this.chatsDir,`${chatId}.json`);
    try {
      await fs.rm(chatPath, { recursive: true, force: true });
    } catch (e) {
      throw new Error(`Could not delete chat directory for chat ${chatId}: ${e.message}`);
    }

    this.chats = this.chats.filter(c => c.id !== chatId)

    await this.__notify(`Chat ${chatId} deleted.`);
    return { ok: true };
  }
}
