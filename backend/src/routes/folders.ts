import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.middleware';
import { getDb } from '../plugins/mariadb';

export async function folderRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  // List folders for user
  fastify.get('/folders', async (request) => {
    const db = getDb();
    const [rows] = await db.query(
      'SELECT id, name, created_at FROM document_folders WHERE user_id = ? ORDER BY name ASC',
      [request.user.userId]
    );
    return rows;
  });

  // Create folder
  fastify.post<{ Body: { name: string } }>('/folders', async (request, reply) => {
    const { name } = request.body;
    if (!name?.trim()) return reply.status(400).send({ error: 'Name required' });
    const db = getDb();
    const [result] = await db.query(
      'INSERT INTO document_folders (user_id, name) VALUES (?, ?)',
      [request.user.userId, name.trim()]
    ) as any;
    return { id: result.insertId, name: name.trim() };
  });

  // Rename folder
  fastify.patch<{ Params: { id: string }; Body: { name: string } }>('/folders/:id', async (request, reply) => {
    const { name } = request.body;
    if (!name?.trim()) return reply.status(400).send({ error: 'Name required' });
    const db = getDb();
    await db.query(
      'UPDATE document_folders SET name = ? WHERE id = ? AND user_id = ?',
      [name.trim(), request.params.id, request.user.userId]
    );
    return { ok: true };
  });

  // Delete folder (documents become unfiled)
  fastify.delete<{ Params: { id: string } }>('/folders/:id', async (request) => {
    const db = getDb();
    await db.query('DELETE FROM document_folders WHERE id = ? AND user_id = ?', [
      request.params.id,
      request.user.userId
    ]);
    return { ok: true };
  });

  // Move document to folder (or unfiled with null)
  fastify.patch<{ Params: { id: string }; Body: { folder_id: number | null } }>(
    '/documents/:id/folder',
    async (request) => {
      const db = getDb();
      await db.query(
        'UPDATE documents SET folder_id = ? WHERE id = ? AND user_id = ?',
        [request.body.folder_id ?? null, request.params.id, request.user.userId]
      );
      return { ok: true };
    }
  );
}
