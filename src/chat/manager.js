import fs from 'node:fs';
import path from 'node:path';
import { LLMProvider } from './LLMProvider';

export class ChatManager {
  constructor(projectRoot, tasksIndexer, filesIndexer) {
    this.projectRoot = projectRoot;
    this.tasksIndexer = tasksIndexer;
    this.filesIndexer = filesIndexer;
    this.chatsDir = path.join(projectRoot, 'chats');
    if (!fs.existsSync(this.chatsDir)) {
      fs.mkdirSync(this.chatsDir, { recursive: true });
    }
  }

  getDefaultChatsDir() {
    return path.join(this.projectRoot, 'chats');
  }

  setChatsDir(dir) {
    this.chatsDir = dir;
    if (!fs.existsSync(this.chatsDir)) {
      fs.mkdirSync(this.chatsDir, { recursive: true });
    }
    return this.chatsDir;
  }

  _getFilesBaseDir() {
    try {
      const snap = this.filesIndexer.getIndex();
      return snap.filesDir || snap.root || this.filesIndexer.filesDir || this.projectRoot;
    } catch {
      return this.projectRoot;
    }
  }

  async getCompletion({ messages, config }) {
    try {
      const systemPrompt = { role: 'system', content: 'You are a helpful project assistant. Discuss tasks, files, and related topics. Use tools to query project info. If user mentions @path, use read_file. You can create new files using create_file (use .md if it is a markdown note).' };
      let currentMessages = [systemPrompt, ...messages];
      const tools = [
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
        // Back-compat tool names used previously (docs)
        {
          type: 'function',
          function: {
            name: 'list_docs',
            description: 'Alias of list_files',
            parameters: { type: 'object', properties: {} },
          },
        },
        {
          type: 'function',
          function: {
            name: 'read_doc',
            description: 'Alias of read_file',
            parameters: {
              type: 'object',
              properties: { path: { type: 'string' } },
              required: ['path'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'create_doc',
            description: 'Alias of create_file',
            parameters: {
              type: 'object',
              properties: { name: { type: 'string' }, content: { type: 'string' } },
              required: ['name', 'content'],
            },
          },
        },
      ];

      const toolsMap = {
        list_files: async () => JSON.stringify(this.filesIndexer.getIndex()),
        read_file: async ({ path: relPath }) => {
          try {
            const base = this._getFilesBaseDir();
            const abs = path.join(base, relPath);
            return fs.readFileSync(abs, 'utf8');
          } catch (error) {
            return `Error: ${error.message}`;
          }
        },
        create_file: async ({ name, content }) => {
          try {
            const base = this._getFilesBaseDir();
            const absPath = path.join(base, name);
            const dir = path.dirname(absPath);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(absPath, content, 'utf8');
            if (typeof this.filesIndexer.buildIndex === 'function') {
              this.filesIndexer.buildIndex();
            }
            return `File ${name} created successfully.`;
          } catch (error) {
            return `Error creating file: ${error.message}`;
          }
        },
        // Aliases for backward compatibility
        list_docs: async () => JSON.stringify(this.filesIndexer.getIndex()),
        read_doc: async ({ path: relPath }) => {
          return await toolsMap.read_file({ path: relPath });
        },
        create_doc: async ({ name, content }) => {
          return await toolsMap.create_file({ name, content });
        },
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
      // Provide richer diagnostics to the UI
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

  listChats() {
    return fs
      .readdirSync(this.chatsDir)
      .filter((file) => file.endsWith('.json'))
      .map((file) => file.replace('.json', ''));
  }

  createChat() {
    const chatId = Date.now().toString();
    const filePath = path.join(this.chatsDir, `${chatId}.json`);
    fs.writeFileSync(filePath, JSON.stringify([]));
    return chatId;
  }

  loadChat(chatId) {
    const filePath = path.join(this.chatsDir, `${chatId}.json`);
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      return [];
    }
  }

  saveChat(chatId, messages) {
    const filePath = path.join(this.chatsDir, `${chatId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(messages));
  }

  deleteChat(chatId) {
    const filePath = path.join(this.chatsDir, `${chatId}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
