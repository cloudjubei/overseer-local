export type NavigationView = 'Home' | 'Documents' | 'Settings' | 'Chat';

export type ChatRole = 'user' | 'assistant' | 'system';
export type ChatMessage = { role: ChatRole; content: string };
export type LLMConfig = { apiBaseUrl: string; apiKey: string; model: string };
