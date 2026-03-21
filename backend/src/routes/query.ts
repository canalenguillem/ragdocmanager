import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware';
import { getMongo } from '../plugins/mongodb';
import { runRagQuery } from '../services/rag.service';

const querySchema = z.object({
  question: z.string().min(3).max(1000),
  document_ids: z.array(z.number()).optional()
});

export async function queryRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  fastify.post('/query', async (request, reply) => {
    const body = querySchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: body.error.flatten() });
    }

    return runRagQuery(body.data.question, request.user.userId, body.data.document_ids);
  });

  fastify.get('/query/history', async (request) => {
    return getMongo()
      .collection('query_history')
      .find({ user_id: request.user.userId })
      .sort({ created_at: -1 })
      .limit(50)
      .toArray();
  });
}
