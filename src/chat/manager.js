import fs from 'node:fs';
import path from 'node:path';
import { ipcMain } from 'electron';
import { LLMProvider } from './LLMProvider';
import { taskManager, filesManager, projectsManager } from '../managers';
import IPC_HANDLER_KEYS from '../ipcHandlersKeys';

export class ChatsManager {
  constructor(projectRoot, window) {
    this.projectRoot = projectRoot;
    this.window = window;
    this.chatsDir = path.join(projectRoot, 'projects/main/chats');
    this._ipcBound = false;
  }

  async init() {
    this.setChatsDir(this.chatsDir)
    this._registerIpcHandlers();
  }

  _registerIpcHandlers() {
    if (this._ipcBound) return;

    const handlers = {};

    handlers[IPC_HANDLER_KEYS.CHATS_COMPLETION] = async (args) => this.getCompletion(args)
    handlers[IPC_HANDLER_KEYS.CHATS_LIST_MODELS] = async (args) => this.listModels(args)
    handlers[IPC_HANDLER_KEYS.CHATS_LIST] = async (args) => this.listChats(args);
    handlers[IPC_HANDLER_KEYS.CHATS_CREATE] = async (args) => this.createChat(args);
    handlers[IPC_HANDLER_KEYS.CHATS_LOAD] = async (args) => this.loadChat(args);
    handlers[IPC_HANDLER_KEYS.CHATS_SAVE] = async (args) => this.saveChat(args);
    handlers[IPC_HANDLER_KEYS.CHATS_DELETE] = async (args) => this.deleteChat(args);

    for (const channel of Object.keys(handlers)) {
      ipcMain.handle(channel, async (event, args) => {
        try {
          return await handlers[channel](args || {});
        } catch (e) {
          console.error(`${channel} failed`, e);
          return { ok: false, error: String(e?.message || e) };
        }
      });
    }

    this._ipcBound = true;
  }

  setChatsDir(dir) {
    this.chatsDir = dir;
    if (!fs.existsSync(this.chatsDir)) {
      fs.mkdirSync(this.chatsDir, { recursive: true });
    }
    return this.chatsDir;
  }

  _getFilesBaseDir() {
    return filesManager.filesDir || this.projectRoot;
  }

  async getCompletion({ messages, config }) {
    try {
      const systemPrompt = { role: 'system', content: 'You are a helpful project assistant. Discuss tasks, files, and related topics. Use tools to query project info. If user mentions @path, use read_file.  If user mentions #reference, use get_task_reference. You can create new files using create_file (use .md if it is a markdown note).' };
      let currentMessages = [systemPrompt, ...messages];
      const tools = [
        {
          type: 'function',
          function: {
            name: 'list_tasks',
            description: 'List all indexed files in the current project scope',
            parameters: { type: 'object', properties: {} },
          },
        },
        {
          type: 'function',
          function: {
            name: 'get_task_reference',
            description: 'Get a task or feature by its visual reference in the current project scope',
            parameters: { type: 'object', properties: {} },
          },
        },
        {
          type: 'function',
          function: {
            name: 'list_files',
            description: 'List all indexed files in the current project scope',
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
            description: 'Create a new file with the given name and content (relative to project scope root)',
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
      ]
        .filter(Boolean)
        .join('\n');
      console.error('Error in chat completion:', details);
      return { role: 'assistant', content: `An error occurred: ${details}` };
    }
  }

  _getChastDir(project) {
    return path.join(projectRoot, `projects/${project.id}/chats`)
  }

  async listModels({config}) {
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

  async listChats({project})
  {
    const chatsDir = this._getChastDir(project)
    const out = await fs.readdir(chatDir)
    return out.filter((file) => file.endsWith('.json'))
      .map((file) => file.replace('.json', ''));
  }

  async createChat({project})
  {
    const chatsDir = this._getChastDir(project)
    const chatId = Date.now().toString();
    const filePath = path.join(chatsDir, `${chatId}.json`);
    await fs.writeFile(filePath, JSON.stringify([]));
    return chatId;
  }

  async loadChat({project,chatId}) {
    const chatsDir = this._getChastDir(project)
    const filePath = path.join(chatsDir, `${chatId}.json`);
    const out = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(out);
  }

  async saveChat({project, chatId, messages}) {
    const chatsDir = this._getChastDir(project)
    const filePath = path.join(chatsDir, `${chatId}.json`);
    await fs.writeFile(filePath, JSON.stringify(messages));
  }

  async deleteChat({project,chatId}) {
    const chatsDir = this._getChastDir(project)
    const filePath = path.join(chatsDir, `${chatId}.json`);

    const exists = await fs.exists(filePath)
    if (exists) {
      await fs.unlink(filePath);
    }
  }
}
