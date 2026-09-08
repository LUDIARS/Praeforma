export const CHAT_IDLE_MS = 30 * 60 * 1000;
export interface ChatMessage { id: string; role: 'user' | 'assistant' | 'system'; text: string; at: number }
export interface ChatView {
  state: 'empty' | 'starting' | 'ready' | 'ended' | 'uncertain';
  messages: ChatMessage[];
  lastActivity: number;
}
