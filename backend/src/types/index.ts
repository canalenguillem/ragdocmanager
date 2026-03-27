export interface User {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  role: 'user' | 'admin';
  created_at: Date;
}

export type EmbeddingProvider = 'openai' | 'gemini' | 'cohere' | 'mistral';
export type ChatProvider = 'openai' | 'gemini';

export interface UserApiKey {
  id: number;
  user_id: number;
  provider: EmbeddingProvider;
  key_type: 'embedding' | 'chat' | 'both';
  is_active: boolean;
  verified_at: Date | null;
  created_at: Date;
}

export interface UserSettings {
  user_id: number;
  embedding_provider: EmbeddingProvider;
  embedding_model: string;
  chat_provider: ChatProvider;
  chat_model: string;
  embedding_dimensions: number;
}

export interface Document {
  id: number;
  user_id: number;
  filename: string;
  original_name: string;
  file_size: number;
  page_count: number;
  status: 'pending' | 'processing' | 'ready' | 'error';
  error_msg: string | null;
  qdrant_collection: string;
  embedding_provider: string | null;
  embedding_model: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface TextChunk {
  text: string;
  page: number;
  bbox: { x: number; y: number; width: number; height: number };
  chunkIndex: number;
  pointId: string;
}

export interface Source {
  document_id: number;
  document_name: string;
  page_number: number;
  bbox: { x: number; y: number; width: number; height: number };
  text: string;
  score: number;
}

export interface QueryResponse {
  answer: string;
  sources: Source[];
  query_id: string;
  conversation_id: string;
}

export interface JwtPayload {
  userId: number;
  email: string;
  role: 'user' | 'admin';
}
