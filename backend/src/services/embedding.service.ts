import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { EmbeddingProvider } from '../types';

async function embedWithGemini(texts: string[], apiKey: string, model: string): Promise<number[][]> {
  const genai = new GoogleGenerativeAI(apiKey);
  const genModel = genai.getGenerativeModel({ model });
  const BATCH = 5;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const embeddings = await Promise.all(
      batch.map(async (text) => {
        const result = await genModel.embedContent({
          content: { role: 'user', parts: [{ text }] }
        });
        return result.embedding.values;
      })
    );
    results.push(...embeddings);
  }

  return results;
}

async function embedWithOpenAI(texts: string[], apiKey: string, model: string): Promise<number[][]> {
  const openai = new OpenAI({ apiKey });
  const BATCH = 20;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH) {
    const response = await openai.embeddings.create({
      model,
      input: texts.slice(i, i + BATCH)
    });
    results.push(...response.data.map((item) => item.embedding));
  }

  return results;
}

export interface EmbedConfig {
  provider: EmbeddingProvider;
  model: string;
  apiKey: string;
}

export async function embedTexts(texts: string[], cfg: EmbedConfig): Promise<number[][]> {
  switch (cfg.provider) {
    case 'gemini':
      return embedWithGemini(texts, cfg.apiKey, cfg.model);
    case 'openai':
      return embedWithOpenAI(texts, cfg.apiKey, cfg.model);
    default:
      throw new Error(`Unsupported embedding provider: ${cfg.provider}`);
  }
}

export const EMBEDDING_MODELS: Record<EmbeddingProvider, { model: string; dimensions: number }[]> = {
  gemini: [
    { model: 'gemini-embedding-2-0', dimensions: 3072 },
    { model: 'text-embedding-004', dimensions: 768 }
  ],
  openai: [
    { model: 'text-embedding-3-large', dimensions: 3072 },
    { model: 'text-embedding-3-small', dimensions: 1536 },
    { model: 'text-embedding-ada-002', dimensions: 1536 }
  ],
  cohere: [
    { model: 'embed-multilingual-v3.0', dimensions: 1024 }
  ],
  mistral: [
    { model: 'mistral-embed', dimensions: 1024 }
  ]
};
