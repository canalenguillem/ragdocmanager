import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config';
import { authenticate } from '../middleware/auth.middleware';
import { getDb } from '../plugins/mariadb';
import { getRedis } from '../plugins/redis';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).max(100)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/auth/register', async (request, reply) => {
    const body = registerSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: body.error.flatten() });
    }

    const { email, password, name } = body.data;
    const db = getDb();
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if ((existing as unknown[]).length > 0) {
      return reply.status(409).send({ error: 'Email already registered' });
    }

    const hash = await bcrypt.hash(password, 12);
    const [result] = await db.query('INSERT INTO users (email, password, name) VALUES (?, ?, ?)', [
      email,
      hash,
      name
    ]);

    const userId = (result as { insertId: number }).insertId;
    const token = jwt.sign({ userId, email, role: 'user' }, config.JWT_SECRET, { expiresIn: '8h' });
    return reply.status(201).send({ token, user: { id: userId, email, name, role: 'user' } });
  });

  fastify.post('/auth/login', async (request, reply) => {
    const body = loginSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: body.error.flatten() });
    }

    const { email, password } = body.data;
    const db = getDb();
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    const users = rows as Array<{ id: number; email: string; password: string; name: string; role: string }>;

    if (!users.length || !(await bcrypt.compare(password, users[0].password))) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const user = users[0];
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      config.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
  });

  fastify.post('/auth/logout', { preHandler: authenticate }, async (request) => {
    const token = request.headers.authorization!.slice(7);
    await getRedis().set(`revoked:${token}`, '1', { EX: 8 * 3600 });
    return { ok: true };
  });

  fastify.get('/auth/me', { preHandler: authenticate }, async (request) => {
    const db = getDb();
    const [rows] = await db.query('SELECT id, email, name, role, created_at FROM users WHERE id = ?', [
      request.user.userId
    ]);
    return (rows as unknown[])[0];
  });
}
