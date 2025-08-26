import fs from 'node:fs';
import path from 'node:path';
import { OpenAI } from 'openai';

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

  async getCompletion({messages, config}) {
    try {
      const openai = new OpenAI({baseURL: config.apiBaseUrl, apiKey: config.apiKey});
      const systemPrompt = {role: 'system', content: 'You are a helpful project assistant. Discuss tasks, documents, and related topics. Use tools to query project info. If user mentions @path, use read_doc.'};
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
        }
      };

      while (true) {
        const response = await openai.chat.completions.create({
          model: config.model,
          messages: currentMessages,
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

  loadChat() {
    const filePath = path.join(this.chatsDir, 'chat.json');
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      return [];
    }
  }

  saveChat(messages) {
    const filePath = path.join(this.chatsDir, 'chat.json');
    fs.writeFileSync(filePath, JSON.stringify(messages));
  }
}