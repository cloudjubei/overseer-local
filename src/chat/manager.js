import fs from 'node:fs';
import path from 'node:path';
import { OpenAI } from 'openai';

export class ChatManager {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.chatsDir = path.join(projectRoot, 'chats');
    if (!fs.existsSync(this.chatsDir)) {
      fs.mkdirSync(this.chatsDir);
    }
  }

  async getCompletion({messages, config}) {
    try {
      const openai = new OpenAI({baseURL: config.apiBaseUrl, apiKey: config.apiKey});
      const systemPrompt = {role: 'system', content: 'You are a helpful project assistant. Discuss tasks, documents, and related topics.'};
      let currentMessages = [systemPrompt, ...messages];
      const tools = []; // empty for now
      const toolsMap = {}; // map of tool names to functions, empty for now

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