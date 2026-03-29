import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('4000'),
  JWT_SECRET: z.string().min(32),
  MARIADB_HOST: z.string(),
  MARIADB_PORT: z.string().default('3306'),
  MARIADB_DATABASE: z.string(),
  MARIADB_USER: z.string(),
  MARIADB_PASSWORD: z.string(),
  MONGO_HOST: z.string(),
  MONGO_PORT: z.string().default('27017'),
  MONGO_DATABASE: z.string(),
  MONGO_USER: z.string(),
  MONGO_PASSWORD: z.string(),
  REDIS_HOST: z.string(),
  REDIS_PORT: z.string().default('6379'),
  REDIS_PASSWORD: z.string(),
  QDRANT_HOST: z.string(),
  QDRANT_PORT: z.string().default('6333'),
  QDRANT_COLLECTION: z.string().default('rag_docs'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_EMBEDDING_MODEL: z.string().default('gemini-embedding-2-0'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_CHAT_MODEL: z.string().default('gpt-4o'),
  API_KEY_ENCRYPTION_SECRET: z.string().min(64),
  MAX_FILE_SIZE_MB: z.string().default('200'),
  UPLOADS_PATH: z.string().default('/app/uploads')
});

export const config = envSchema.parse(process.env);
export type Config = z.infer<typeof envSchema>;
