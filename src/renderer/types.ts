export type NavigationView = 'Home' | 'Files' | 'Settings' | 'Chat' | 'Notifications';

export type ChatRole = 'user' | 'assistant' | 'system';
export type ChatMessage = { role: ChatRole, content: string, model?: string };

export type LLMProviderType = 'openai' | 'anthropic' | 'gemini' | 'xai' | 'local' | 'custom';
export type LLMConfig = {
  id: string,
  name: string,
  provider: LLMProviderType,
  apiBaseUrl: string,
  apiKey: string,
  model: string
};
