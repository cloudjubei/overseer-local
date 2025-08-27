export type NavigationView = 'Home' | 'Documents' | 'Settings' | 'Chat' | 'Notifications';

export type ChatRole = 'user' | 'assistant' | 'system';
export type ChatMessage = { role: ChatRole, content: string, model?: string };
export type LLMConfig = { id: string, name: string, apiBaseUrl: string; apiKey: string; model: string };
