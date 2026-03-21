import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware';
import { EmbeddingProvider } from '../types';
import {
  deleteApiKey,
  getApiKey,
  getUserSettings,
  listApiKeys,
  saveApiKey,
  updateUserSettings,
  verifyApiKey
} from '../services/apikeys.service';
import { EMBEDDING_MODELS } from '../services/embedding.service';

const saveKeySchema = z.object({
  provider: z.enum(['openai', 'gemini', 'cohere', 'mistral']),
  key_type: z.enum(['embedding', 'chat', 'both']).default('both'),
  api_key: z.string().min(10)
});

const settingsSchema = z.object({
  embedding_provider: z.enum(['openai', 'gemini', 'cohere', 'mistral']).optional(),
  embedding_model: z.string().optional(),
  chat_provider: z.enum(['openai', 'gemini']).optional(),
  chat_model: z.string().optional(),
  embedding_dimensions: z.number().int().positive().optional()
});

export async function settingsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/settings', async (request) => {
    const [settings, keys] = await Promise.all([
      getUserSettings(request.user.userId),
      listApiKeys(request.user.userId)
    ]);
    return { settings, api_keys: keys, available_models: EMBEDDING_MODELS };
  });

  fastify.put('/settings', async (request, reply) => {
    const body = settingsSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: body.error.flatten() });
    }

    await updateUserSettings(request.user.userId, body.data);
    return getUserSettings(request.user.userId);
  });

  fastify.post('/settings/api-keys', async (request, reply) => {
    const body = saveKeySchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: body.error.flatten() });
    }

    await saveApiKey(request.user.userId, body.data.provider, body.data.key_type, body.data.api_key);
    const verification = await verifyApiKey(request.user.userId, body.data.provider, body.data.api_key);
    return reply.status(201).send({ ok: true, verified: verification.ok, error: verification.error });
  });

  fastify.post<{ Params: { id: string } }>('/settings/api-keys/:id/verify', async (request, reply) => {
    const keys = await listApiKeys(request.user.userId) as Array<{ id: number; provider: string }>;
    const key = keys.find((item) => item.id === Number(request.params.id));
    if (!key) {
      return reply.status(404).send({ error: 'Key not found' });
    }

    const rawKey = await getApiKey(request.user.userId, key.provider as EmbeddingProvider, 'both');
    if (!rawKey) {
      return reply.status(404).send({ error: 'Key data not found' });
    }

    return verifyApiKey(request.user.userId, key.provider as EmbeddingProvider, rawKey);
  });

  fastify.delete<{ Params: { id: string } }>('/settings/api-keys/:id', async (request) => {
    await deleteApiKey(request.user.userId, Number(request.params.id));
    return { ok: true };
  });
}
