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
      const response = await openai.chat.completions.create({model: config.model, messages: [systemPrompt, ...messages], stream: false});
      return response.choices[0].message;
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