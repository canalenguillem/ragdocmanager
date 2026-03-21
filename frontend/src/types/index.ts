export interface User {
  id: number;
  email: string;
  name: string;
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
