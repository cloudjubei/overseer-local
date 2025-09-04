import { ipcMain } from 'electron';
import path from 'path';
import IPC_HANDLER_KEYS from "../ipcHandlersKeys";
import ChatsStorage from './storage';
import { LLMProvider } from './LLMProvider'
import { tasksManager, filesManager, projectsManager } from '../managers';

const MESSAGES_TO_SEND = 10

export class ChatsManager {
  constructor(projectRoot, window, projectsManager, tasksManager, filesManager, factory) {
    this.projectRoot = projectRoot;
    this.window = window;
    this.storages = {};
    this._ipcBound = false;

    this.projectsManager = projectsManager
    this.tasksManager = tasksManager
    this.filesManager = filesManager
    this.factory = factory
  }

  async __getStorage(projectId) {
    if (!this.storages[projectId]) {
      const project = await this.projectsManager.getProject(projectId)
      if (!project){ return }
      const chatsDir = path.join(this.projectsManager.projectsDir, `${projectId}/chats`);
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
    handlers[IPC_HANDLER_KEYS.CHATS_LIST_MODELS] = async ({ config }) => this.listModels(config);
    handlers[IPC_HANDLER_KEYS.CHATS_LIST] = async ({ projectId }) => (await this.__getStorage(projectId))?.listChats();
    handlers[IPC_HANDLER_KEYS.CHATS_CREATE] = async ({ projectId }) => (await this.__getStorage(projectId))?.createChat();
    handlers[IPC_HANDLER_KEYS.CHATS_GET] = async ({ projectId, id }) => (await this.__getStorage(projectId))?.getChat(id);
    handlers[IPC_HANDLER_KEYS.CHATS_DELETE] = async ({ projectId, chatId }) => (await this.__getStorage(projectId))?.deleteChat(chatId);
    handlers[IPC_HANDLER_KEYS.CHATS_COMPLETION] = async ({ projectId, chatId, newMessages, config }) => this.getCompletion(projectId, chatId, newMessages, config);

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

  _withAttachmentsAsMentions(messages) {
    // Transform messages with attachments into content that includes @path mentions
    return (messages || []).map((m) => {
      try {
        if (m && Array.isArray(m.attachments) && m.attachments.length) {
          const unique = Array.from(new Set(m.attachments.filter(Boolean)));
          const attachText = unique.map((p) => `@${p}`).join("\n");
          const sep = m.content && attachText ? "\n\n" : '';
          return { ...m, content: `${m.content || ''}${sep}Attached files:\n${attachText}` };
        }
      } catch {}
      return m;
    });
  }

  async _constructSystemPrompt(projectId) {
    const project = await this.projectsManager.getProject(projectId);
    
    const parts = [
      'You are a helpful project assistant. Discuss tasks, files, and related topics. Use tools to query project info. If user mentions @path, use read_file.  If user mentions #reference, use get_task_reference. You can create new files using write_file (use .md if it is a markdown note).'
    ];

    if (project) {
      parts.push(`\n#CURRENT PROJECT: ${project.name}`);
      if (project.description) {
        parts.push(`##DESCRIPTION:\n${project.description}`);
      }
    }
    
    const task = await this.tasksManager.getActiveTask(projectId);
    if (task) {
        parts.push(`\n#ACTIVE TASK: ${task.title} (ID: ${task.id})`);
        if(task.description){
            parts.push(`##DESCRIPTION:\n${task.description}`);
        }
    }

    return parts.join('\n');
  }

  async getCompletion(projectId, chatId, newMessages, config) {
    try {
      const storage = await this.__getStorage(projectId)
      const chat = await storage.getChat(chatId)
      if (!chat) throw new Error(`Couldn't load chat with chatId: ${chatId}`)

      const systemPromptContent = await this._constructSystemPrompt(projectId);
      const systemPrompt = { role: 'system', content: systemPromptContent };

      let messagesHistory = [...chat.messages, ...newMessages];
      if (messagesHistory.length > MESSAGES_TO_SEND){
        messagesHistory.splice(0, messagesHistory.length - MESSAGES_TO_SEND)
      }
      // Build provider messages with attachments folded into content for tool discovery
      const providerMessages = this._withAttachmentsAsMentions(messagesHistory);
      let currentMessages = [systemPrompt, ...providerMessages];

      const repoRoot = this.projectRoot
      const { tools, callTool } = this.factory.buildChatTools({ repoRoot, projectId });

      const provider = new LLMProvider(config);

      let rawResponses = []
      while (true) {
        const response = await provider.createCompletion({
          model: config.model,
          messages: currentMessages,
          tools: tools.length > 0 ? tools : undefined,
          tool_choice: tools.length > 0 ? 'auto' : undefined,
          stream: false,
        });

        const message = response?.choices?.[0]?.message;
        if (!message) {
          throw new Error('LLM returned an unexpected response format.');
        }
        rawResponses.push(JSON.stringify(response))

        if (!message.tool_calls || message.tool_calls.length === 0) {
          return await storage.saveChat(chatId, [...chat.messages, ...newMessages, message], [...(chat.rawResponses ?? []), rawResponses])
        }

        currentMessages.push(message);

        for (const toolCall of message.tool_calls) {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments || '{}');
          const functionResponse = await callTool(functionName, functionArgs);
          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(functionResponse),
          });
        }
      }
    } catch (error) {
      const details = [
        error?.message,
        error?.response?.data ? JSON.stringify(error.response.data) : null,
        error?.cause?.message || null,
      ].filter(Boolean).join('\n');
      console.error('Error in chat completion:', details);
    }
  }

  async listModels(config) {
    try {
      const provider = new LLMProvider(config);
      if (typeof provider.listModels === 'function') {
        return await provider.listModels();
      }
      return [];
    } catch (error) {
      throw error;
    }
  }
}
