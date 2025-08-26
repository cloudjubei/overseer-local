import fs from 'node:fs';
import path from 'node:path';
import { BaseProvider } from './providers/base';
import { OpenAIProvider } from './providers/openai';
import { LiteLLMProvider } from './providers/litellm';
import { LMStudioProvider } from './providers/lmstudio';

export class ChatManager {
  constructor(projectRoot, tasksIndexer, docsIndexer) {
    this.projectRoot = projectRoot;
    this.tasksIndexer = tasksIndexer;
    this.docsIndexer = docsIndexer;
    this.chatsDir = path.join(projectRoot, 'chats');
    if (!fs.existsSync(this.chatsDir)) {
      fs.mkdirSync(this.chatsDir);
    }
  }

  getProvider(config) {
    const provider = config.provider || 'litellm';
    const providerClasses = {
      openai: OpenAIProvider,
      litellm: LiteLLMProvider,
      lmstudio: LMStudioProvider
    };
    const ProviderClass = providerClasses[provider];
    if (!ProviderClass) {
      throw new Error(`Unknown provider: ${provider}`);
    }
    return new ProviderClass(config);
  }

  async getCompletion({messages, config}) {
    try {
      const systemPrompt = {role: 'system', content: 'You are a helpful project assistant. Discuss tasks, documents, and related topics. Use tools to query project info. If user mentions @path, use read_doc. You can create new documents using create_doc.'};
      let currentMessages = [systemPrompt, ...messages];
      const tools = [
        {
          type: 'function',
          function: {
            name: 'list_tasks',
            description: 'List all tasks in the project',
            parameters: { type: 'object', properties: {} }
          }
        },
        {
          type: 'function',
          function: {
            name: 'list_docs',
            description: 'List all documents in the project',
            parameters: { type: 'object', properties: {} }
          }
        },
        {
          type: 'function',
          function: {
            name: 'read_doc',
            description: 'Read the content of a document by its relative path',
            parameters: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'Relative path to the doc' }
              },
              required: ['path']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'create_doc',
            description: 'Create a new document with the given name and content',
            parameters: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Name of the document (relative path, including .md extension)' },
                content: { type: 'string', description: 'Content of the document' }
              },
              required: ['name', 'content']
            }
          }
        }
      ];
      const toolsMap = {
        list_tasks: async () => JSON.stringify(this.tasksIndexer.getIndex().tasksById),
        list_docs: async () => JSON.stringify(this.docsIndexer.getIndex().tree),
        read_doc: async ({ path }) => {
          try {
            return await this.docsIndexer.getFile(path);
          } catch (error) {
            return `Error: ${error.message}`;
          }
        },
        create_doc: async ({ name, content }) => {
          try {
            const relPath = name;
            const absPath = path.join(this.docsIndexer.docsDir, relPath);
            const dir = path.dirname(absPath);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(absPath, content, 'utf8');
            this.docsIndexer.buildIndex();
            return `Document ${name} created successfully.`;
          } catch (error) {
            return `Error creating document: ${error.message}`;
          }
        }
      };

      const llmProvider = this.getProvider(config);

      while (true) {
        const response = await llmProvider.createCompletion({
          model: config.model,
          messages: currentMessages,
          apiKey: config.apiKey,
          tools: tools.length > 0 ? tools : undefined,
          tool_choice: tools.length > 0 ? 'auto' : undefined,
          stream: false
        });
        const message = response.choices[0].message;

        if (!message.tool_calls) {
          return message;
        }

        currentMessages.push(message);

        for (const toolCall of message.tool_calls) {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);
          const functionToCall = toolsMap[functionName];
          if (!functionToCall) {
            throw new Error(`Unknown tool: ${functionName}`);
          }
          const functionResponse = await functionToCall(functionArgs);
          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(functionResponse)
          });
        }
      }
    } catch (error) {
      console.error('Error in chat completion:', error);
      return { role: 'assistant', content: `An error occurred: ${error.message}` };
    }
  }

  async listModels(config) {
    try {
      const provider = this.getProvider(config);
      return await provider.listModels();
    } catch (error) {
      throw error;
    }
  }

  listChats() {
    return fs.readdirSync(this.chatsDir).filter(file => file.endsWith('.json')).map(file => file.replace('.json', ''));
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