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
    this.watcher = chokidar.watch(path.join(this.chatsDir, '*/chat.json'), {
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
        const chatDirs = await fs.readdir(this.chatsDir, { withFileTypes: true });
        const chats = [];
        for (const dirent of chatDirs) {
          if (dirent.isDirectory()) {
            const chatId = dirent.name;
            const chatFilePath = path.join(this.chatsDir, chatId, 'chat.json');
            try {
              const content = await fs.readFile(chatFilePath, 'utf-8');
              const chat = JSON.parse(content);
              if (chat.id !== chatId) {
                continue;
              }
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
    const chatDirs = await fs.readdir(this.chatsDir, { withFileTypes: true });
    const existingIds = chatDirs
      .filter(d => d.isDirectory())
      .map(d => parseInt(d.name, 10));
    const nextIdNum = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
    const nextId = String(nextIdNum);

    const newChatDir = path.join(this.chatsDir, nextId);
    await fs.mkdir(newChatDir, { recursive: true });

    const newChat = {
      id: nextId,
      messages: []
    };

    const chatPath = path.join(newChatDir, 'chat.json');
    await fs.writeFile(chatPath, JSON.stringify(newChat, null, 2), 'utf-8');
    this.chats.push(newChat)
    await this.__notify(`New chat ${nextId} added.`)
    return { ok: true, id: nextId };
  }

  async saveChat(chatId, messages) {
    const chatPath = path.join(this.chatsDir, chatId, 'chat.json');
    let chatData;
    try {
      const raw = await fs.readFile(chatPath, 'utf-8');
      chatData = JSON.parse(raw);
    } catch (e) {
      throw new Error(`Could not read or parse chat file for chat ${chatId}: ${e.message}`);
    }

    const next = { ...chatData, messages };

    await fs.writeFile(chatPath, JSON.stringify(next, null, 2), 'utf-8');
    this.chats = this.chats.map(c => c.id === next.id ? next : c)

    await this.__notify(`Chat ${chatId} saved.`)
    return { ok: true };
  }

  async deleteChat(chatId) {
    const chatDirPath = path.join(this.chatsDir, chatId);
    try {
      await fs.rm(chatDirPath, { recursive: true, force: true });
    } catch (e) {
      throw new Error(`Could not delete chat directory for chat ${chatId}: ${e.message}`);
    }

    this.chats = this.chats.filter(c => c.id !== chatId)

    await this.__notify(`Chat ${chatId} deleted.`);
    return { ok: true };
  }
}
