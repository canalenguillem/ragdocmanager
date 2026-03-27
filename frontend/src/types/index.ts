export interface User {
  id: number;
  email: string;
  name: string;
  phone?: string | null;
  role: 'user' | 'admin';
}

export type EmbeddingProvider = 'openai' | 'gemini' | 'cohere' | 'mistral';
export type ChatProvider = 'openai' | 'gemini';

export interface UserSettings {
  user_id: number;
  embedding_provider: EmbeddingProvider;
  embedding_model: string;
  chat_provider: ChatProvider;
  chat_model: string;
  embedding_dimensions: number;
}

export interface ApiKey {
  id: number;
  provider: EmbeddingProvider;
  key_type: 'embedding' | 'chat' | 'both';
  is_active: boolean;
  verified_at: string | null;
  created_at: string;
}

export interface ModelOption {
  model: string;
  dimensions: number;
}

export interface AvailableModels {
  gemini: ModelOption[];
  openai: ModelOption[];
  cohere: ModelOption[];
  mistral: ModelOption[];
}

export interface Document {
  id: number;
  original_name: string;
  file_size: number;
  page_count: number;
  status: 'pending' | 'processing' | 'ready' | 'error';
  error_msg: string | null;
  embedding_provider: string | null;
  embedding_model: string | null;
  folder_id: number | null;
  created_at: string;
}

export interface Source {
  document_id: number;
  document_name: string;
  page_number: number;
  bbox: { x: number; y: number; width: number; height: number };
  text: string;
  score: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  created_at: Date;
}

export interface ConversationSummary {
  _id: string;
  conversation_id: string;
  title: string;
  question: string;
  answer: string;
  sources: Source[];
  document_ids?: number[];
  created_at: string;
  message_count: number;
}

export interface QueryHistoryEntry {
  _id: string;
  query_id: string;
  conversation_id?: string;
  title?: string;
  question: string;
  answer: string;
  sources: Source[];
  document_ids?: number[];
  created_at: string;
}

export interface AdminUser extends User {
  created_at: string;
  document_count: number;
  chat_count: number;
}
