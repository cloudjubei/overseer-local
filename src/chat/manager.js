import { ipcMain } from 'electron';
import path from 'path';
import IPC_HANDLER_KEYS from "../ipcHandlersKeys";
import ChatsStorage from './storage';
import fetch from 'node-fetch';

function resolveChatsDir(projectRoot) {
  const candidates = [];
  const root = path.isAbsolute(projectRoot) ? projectRoot : path.resolve(projectRoot);
  candidates.push(path.join(root, 'chats'));
  candidates.push(path.resolve(root, '..', 'chats'));
  candidates.push(path.resolve(root, '..', '..', 'chats'));
  candidates.push(path.resolve(process.cwd(), 'chats'));
  return candidates[0];
}

export class ChatsManager {
  constructor(projectRoot, window, projectsManager) {
    this.projectRoot = projectRoot;
    this.window = window;
    this.storages = {};
    this._ipcBound = false;

    this.projectsManager = projectsManager
  }

  async __getStorage(projectId) {
    if (!this.storages[projectId]) {
      const project = await this.projectsManager.getProject(projectId)
      if (!project){ return }
      const projectRoot = path.resolve(this.projectsManager.projectsDir, project.path);
      const chatsDir = resolveChatsDir(projectRoot);
      const storage = new ChatsStorage(projectId, chatsDir, this.window);
      await storage.init();
      this.storages[projectId] = storage;
    }
    return this.storages[projectId];
  }

  async init() {
    await this.__getStorage('main');

    this._registerIpcHandlers();
  }

  _registerIpcHandlers() {
    if (this._ipcBound) return;

    const handlers = {};
    handlers[IPC_HANDLER_KEYS.CHATS_LIST] = async ({ project }) => (await this.__getStorage(project.id))?.listChats();
    handlers[IPC_HANDLER_KEYS.CHATS_CREATE] = async ({ project }) => (await this.__getStorage(project.id))?.createChat();
    handlers[IPC_HANDLER_KEYS.CHATS_LOAD] = async ({ project, id }) => (await this.__getStorage(project.id))?.getChat(id);
    handlers[IPC_HANDLER_KEYS.CHATS_SAVE] = async ({ project, chatId, messages }) => (await this.__getStorage(project.id))?.saveChat(chatId, messages);
    handlers[IPC_HANDLER_KEYS.CHATS_DELETE] = async ({ project, chatId }) => (await this.__getStorage(project.id))?.deleteChat(chatId);
    handlers[IPC_HANDLER_KEYS.CHATS_COMPLETION] = async ({ messages, config }) => this.getCompletion(messages, config);
    handlers[IPC_HANDLER_KEYS.CHATS_LIST_MODELS] = async ({ config }) => this.listModels(config);

    for (const handler of Object.keys(handlers)) {
      ipcMain.handle(handler, async (event, args) => {
        try {
          return await handlers[handler](args);
        } catch (e) {
          console.error(`${handler} failed`, e);
          return { ok: false, error: String(e?.message || e) };
        }
      });
    }

    this._ipcBound = true;
  }

  async getCompletion(messages, config) {
    switch (config.provider) {
      case 'openai':
      case 'local':
      case 'custom':
        const openaiResponse = await fetch(`${config.apiBaseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
          },
          body: JSON.stringify({
            model: config.model,
            messages,
          })
        });
        const openaiData = await openaiResponse.json();
        if (openaiData.choices && openaiData.choices[0]) {
          return { role: 'assistant', content: openaiData.choices[0].message.content, model: config.model };
        } else {
          throw new Error('No completion from OpenAI-like provider');
        }
      case 'anthropic':
        const anthropicResponse = await fetch(`https://api.anthropic.com/v1/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: config.model,
            messages,
            max_tokens: 1024
          })
        });
        const anthropicData = await anthropicResponse.json();
        if (anthropicData.content && anthropicData.content[0] && anthropicData.content[0].type === 'text') {
          return { role: 'assistant', content: anthropicData.content[0].text, model: config.model };
        } else {
          throw new Error('No completion from Anthropic');
        }
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }

  async listModels(config) {
    switch (config.provider) {
      case 'openai':
      case 'local':
      case 'custom':
        const modelsResponse = await fetch(`${config.apiBaseUrl}/v1/models`, {
          headers: {
            'Authorization': `Bearer ${config.apiKey}`
          }
        });
        const modelsData = await modelsResponse.json();
        return modelsData.data ? modelsData.data.map(m => m.id) : [];
      case 'anthropic':
        // Anthropic doesn't have a list models endpoint; hardcode known models
        return ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-2.1', 'claude-2.0'];
      default:
        throw new Error(`Unsupported provider for listing models: ${config.provider}`);
    }
  }
}
