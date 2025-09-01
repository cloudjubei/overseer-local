import fs from 'fs/promises';
import path from 'path';
import chokidar from 'chokidar';
import IPC_HANDLER_KEYS from "../ipcHandlersKeys";

async function pathExists(p) {
  try { await fs.stat(p); return true; } catch { return false; }
}

export default class ChatsStorage {
  constructor(projectId, chatsDir, window) {
    this.projectId = projectId;
    this.chatsDir = chatsDir;
    this.window = window;
    this.watcher = null;
    this.chats = {};
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
      this.window.webContents.send(IPC_HANDLER_KEYS.CHATS_SUBSCRIBE, { projectId: this.projectId });
    }
  }

  async __rebuildAndNotify(msg) {
    await this.__buildIndex();
    this.__notify(msg);
  }

  async __buildIndex() {
    this.chats = {};
    try {
      if (await pathExists(this.chatsDir)) {
        const files = await fs.readdir(this.chatsDir, { withFileTypes: true });
        for (const file of files) {
          if (file.isFile() && file.name.endsWith('.json')) {
            const chatId = file.name.slice(0, -5);
            const filePath = path.join(this.chatsDir, file.name);
            try {
              const content = await fs.readFile(filePath, 'utf-8');
              this.chats[chatId] = JSON.parse(content);
            } catch (err) {
              console.error(`Failed to load chat ${chatId}: ${err}`);
            }
          }
        }
      }
    } catch (err) {
      console.error(`Failed to build chats index: ${err}`);
    }
  }

  async listChats() {
    return Object.keys(this.chats);
  }

  async createChat() {
    const chatId = Date.now().toString();
    const filePath = path.join(this.chatsDir, `${chatId}.json`);
    await fs.mkdir(this.chatsDir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify([]), 'utf-8');
    this.chats[chatId] = [];
    this.__notify(`New chat ${chatId} created.`);
    return chatId;
  }

  async loadChat(chatId) {
    return this.chats[chatId] || null;
  }

  async saveChat(chatId, messages) {
    const filePath = path.join(this.chatsDir, `${chatId}.json`);
    await fs.writeFile(filePath, JSON.stringify(messages), 'utf-8');
    this.chats[chatId] = messages;
    this.__notify(`Chat ${chatId} saved.`);
  }

  async deleteChat(chatId) {
    const filePath = path.join(this.chatsDir, `${chatId}.json`);
    if (await pathExists(filePath)) {
      await fs.unlink(filePath);
      delete this.chats[chatId];
      this.__notify(`Chat ${chatId} deleted.`);
    }
  }
}
