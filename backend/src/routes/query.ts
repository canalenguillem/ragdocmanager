import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware';
import { getMongo } from '../plugins/mongodb';
import { runRagQuery } from '../services/rag.service';

const querySchema = z.object({
  question: z.string().min(3).max(8000),
  document_ids: z.array(z.number()).optional(),
  conversation_id: z.string().uuid().optional()
});

const historyQuerySchema = z.object({
  document_ids: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(',')
            .map((id) => Number(id.trim()))
            .filter((id) => Number.isFinite(id))
        : []
    )
});

export async function queryRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  fastify.post('/query', async (request, reply) => {
    const body = querySchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: body.error.flatten() });
    }

    return runRagQuery(
      body.data.question,
      request.user.userId,
      body.data.document_ids,
      body.data.conversation_id
    );
  });

  fastify.get('/query/history', async (request) => {
    const query = historyQuerySchema.parse(request.query);
    const filter: Record<string, unknown> = { user_id: request.user.userId };

    if (query.document_ids.length) {
      filter.$or = [
        { document_ids: { $in: query.document_ids } },
        { 'sources.document_id': { $in: query.document_ids } }
      ];
    }

    return getMongo()
      .collection('query_history')
      .aggregate([
        { $match: filter },
        { $sort: { created_at: -1 } },
        {
          $group: {
            _id: { $ifNull: ['$conversation_id', '$query_id'] },
            conversation_id: { $first: { $ifNull: ['$conversation_id', '$query_id'] } },
            title: { $first: { $ifNull: ['$title', '$question'] } },
            question: { $first: '$question' },
            answer: { $first: '$answer' },
            sources: { $first: '$sources' },
            document_ids: { $first: '$document_ids' },
            created_at: { $first: '$created_at' },
            message_count: { $sum: 1 }
          }
        },
        { $sort: { created_at: -1 } },
        { $limit: 50 }
      ])
      .toArray();
  });

  fastify.get<{ Params: { conversationId: string } }>('/query/history/:conversationId', async (request) => {
    return getMongo()
      .collection('query_history')
      .find({
        user_id: request.user.userId,
        $or: [
          { conversation_id: request.params.conversationId },
          { query_id: request.params.conversationId }
        ]
      })
      .sort({ created_at: 1 })
      .toArray();
  });

  fastify.delete<{ Params: { conversationId: string } }>('/query/history/:conversationId', async (request) => {
    await getMongo().collection('query_history').deleteMany({
      user_id: request.user.userId,
      $or: [
        { conversation_id: request.params.conversationId },
        { query_id: request.params.conversationId }
      ]
    });

    return { ok: true };
  });
}
