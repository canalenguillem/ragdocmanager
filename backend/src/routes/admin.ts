import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';
import { getDb } from '../plugins/mariadb';
import { getMongo } from '../plugins/mongodb';

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(2).max(100).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  role: z.enum(['user', 'admin']).optional()
});

export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireAdmin);

  fastify.get('/admin/users', async () => {
    const db = getDb();
    const [rows] = await db.query(`
      SELECT
        u.id,
        u.email,
        u.name,
        u.phone,
        u.role,
        u.created_at,
        COUNT(DISTINCT d.id) AS document_count
      FROM users u
      LEFT JOIN documents d ON d.user_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);

    const users = rows as Array<{
      id: number;
      email: string;
      name: string;
      phone: string | null;
      role: 'user' | 'admin';
      created_at: Date;
      document_count: number;
    }>;

    const conversations = await getMongo()
      .collection('query_history')
      .aggregate([
        {
          $group: {
            _id: { user_id: '$user_id', conversation_id: { $ifNull: ['$conversation_id', '$query_id'] } }
          }
        },
        {
          $group: {
            _id: '$_id.user_id',
            chat_count: { $sum: 1 }
          }
        }
      ])
      .toArray();

    const chatCountByUser = new Map(
      conversations.map((entry) => [Number(entry._id), Number(entry.chat_count)])
    );

    return users.map((user) => ({
      ...user,
      document_count: Number(user.document_count),
      chat_count: chatCountByUser.get(user.id) ?? 0
    }));
  });

  fastify.patch<{ Params: { id: string } }>('/admin/users/:id', async (request, reply) => {
    const body = updateUserSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: body.error.flatten() });
    }

    const userId = Number(request.params.id);
    if (!Number.isFinite(userId)) {
      return reply.status(400).send({ error: 'Invalid user id' });
    }

    const updates = Object.entries(body.data).filter(([, value]) => value !== undefined);
    if (!updates.length) {
      return reply.status(400).send({ error: 'No changes provided' });
    }

    const normalizedUpdates = Object.fromEntries(
      updates.map(([key, value]) => {
        if (key === 'email' && typeof value === 'string') {
          return [key, value.trim().toLowerCase()];
        }
        if (key === 'phone') {
          return [key, typeof value === 'string' && value.trim() ? value.trim() : null];
        }
        return [key, value];
      })
    ) as Record<string, string | null>;

    if (userId === request.user.userId && normalizedUpdates.role === 'user') {
      return reply.status(400).send({ error: 'You cannot remove your own admin role' });
    }

    const db = getDb();

    if (normalizedUpdates.email) {
      const [existing] = await db.query('SELECT id FROM users WHERE email = ? AND id <> ?', [
        normalizedUpdates.email,
        userId
      ]);
      if ((existing as unknown[]).length) {
        return reply.status(409).send({ error: 'Email already in use' });
      }
    }

    await db.query(
      `UPDATE users SET ${Object.keys(normalizedUpdates).map((field) => `${field} = ?`).join(', ')} WHERE id = ?`,
      [...Object.values(normalizedUpdates), userId]
    );

    const [rows] = await db.query('SELECT id, email, name, phone, role, created_at FROM users WHERE id = ?', [userId]);
    return (rows as unknown[])[0];
  });

  fastify.delete<{ Params: { id: string } }>('/admin/users/:id', async (request, reply) => {
    const userId = Number(request.params.id);
    if (!Number.isFinite(userId)) {
      return reply.status(400).send({ error: 'Invalid user id' });
    }
    if (userId === request.user.userId) {
      return reply.status(400).send({ error: 'You cannot delete your own account' });
    }

    const db = getDb();
    await db.query('DELETE FROM users WHERE id = ?', [userId]);
    return { ok: true };
  });
}
