import { ipcMain } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { LLMProvider } from './LLMProvider';
import IPC_HANDLER_KEYS from '../ipcHandlersKeys';
import ChatsStorage from './storage';
import { tasksManager, filesManager, projectsManager } from '../managers';

function resolveChatsDir(projectRoot) {
  return path.join(projectRoot, 'chats');
}

export class ChatsManager {
  constructor(projectRoot, window, projectsManager) {
    this.projectRoot = projectRoot;
    this.window = window;
    this.storages = {};
    this._ipcBound = false;

    this.projectsManager = projectsManager
  }

  async init() {
    this._registerIpcHandlers();
  }

  async __getStorage(projectId) {
    if (!this.storages[projectId]) {
      const project = projectsManager.index.projectsById[projectId];
      if (!project) {
        throw new Error(`Unknown project ${projectId}`);
      }
      const projectRoot = path.resolve(projectsManager.projectsDir, project.path);
      const chatsDir = resolveChatsDir(projectRoot);
      const storage = new ChatsStorage(projectId, chatsDir, this.window);
      await storage.init();
      this.storages[projectId] = storage;
    }
    return this.storages[projectId];
  }

  _registerIpcHandlers() {
    if (this._ipcBound) return;

    const handlers = {};
    handlers[IPC_HANDLER_KEYS.CHATS_COMPLETION] = async (args) => this.getCompletion(args);
    handlers[IPC_HANDLER_KEYS.CHATS_LIST_MODELS] = async (args) => this.listModels(args);
    handlers[IPC_HANDLER_KEYS.CHATS_LIST] = async ({ project }) => (await this.__getStorage(project.id)).listChats();
    handlers[IPC_HANDLER_KEYS.CHATS_CREATE] = async ({ project }) => (await this.__getStorage(project.id)).createChat();
    handlers[IPC_HANDLER_KEYS.CHATS_LOAD] = async ({ project, chatId }) => (await this.__getStorage(project.id)).loadChat(chatId);
    handlers[IPC_HANDLER_KEYS.CHATS_SAVE] = async ({ project, chatId, messages }) => (await this.__getStorage(project.id)).saveChat(chatId, messages);
    handlers[IPC_HANDLER_KEYS.CHATS_DELETE] = async ({ project, chatId }) => (await this.__getStorage(project.id)).deleteChat(chatId);

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

  async getCompletion({ project, messages, config }) {
    try {
      const systemPrompt = { role: 'system', content: 'You are a helpful project assistant. Discuss tasks, files, and related topics. Use tools to query project info. If user mentions @path, use read_file.  If user mentions #reference, use get_task_reference. You can create new files using create_file (use .md if it is a markdown note).' };
      let currentMessages = [systemPrompt, ...messages];
      const tools = [
        {
          type: 'function',
          function: {
            name: 'list_tasks',
            description: 'List all tasks in the current project',
            parameters: { type: 'object', properties: {} },
          },
        },
        {
          type: 'function',
          function: {
            name: 'get_task_reference',
            description: 'Get a task or feature by its reference in the current project',
            parameters: {
              type: 'object',
              properties: {
                reference: { type: 'string', description: 'Task or feature reference (e.g., #1 or #1.2)' },
              },
              required: ['reference'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'list_files',
            description: 'List all files in the current project',
            parameters: { type: 'object', properties: {} },
          },
        },
        {
          type: 'function',
          function: {
            name: 'read_file',
            description: 'Read the content of a file by its project-relative path',
            parameters: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'Project-relative path to the file' },
              },
              required: ['path'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'create_file',
            description: 'Create a new file with the given name and content (relative to project root)',
            parameters: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Project-relative path (include extension, e.g. notes/todo.md)' },
                content: { type: 'string', description: 'Content of the file' },
              },
              required: ['name', 'content'],
            },
          },
        },
      ];

      const toolsMap = {
        list_tasks: async (args) => taskManager.listTasks(args),
        get_task_reference: async (args) => taskManager.getTaskReference(args),
        list_files: async (args) => filesManager.listFiles(args),
        read_file: async (args) => filesManager.readFile(args),
        create_file: async (args) => filesManager.createFile(args)
      };

      const provider = new LLMProvider(config);

      while (true) {
        const response = await provider.createCompletion({
          model: config.model,
          messages: currentMessages,
          tools: tools.length > 0 ? tools : undefined,
          tool_choice: tools.length > 0 ? 'auto' : undefined,
          timeout: 1000,
          stream: false,
        });

        const message = response?.choices?.[0]?.message;
        if (!message) {
          throw new Error('LLM returned an unexpected response format.');
        }

        if (!message.tool_calls || message.tool_calls.length === 0) {
          return message;
        }

        currentMessages.push(message);

        for (const toolCall of message.tool_calls) {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments || '{}');
          const functionToCall = toolsMap[functionName];
          if (!functionToCall) {
            throw new Error(`Unknown tool: ${functionName}`);
          }
          const functionResponse = await functionToCall(functionArgs);
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
      return { role: 'assistant', content: `An error occurred: ${details}` };
    }
  }

  async listModels({ config }) {
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
