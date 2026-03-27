import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config';
import { authenticate } from '../middleware/auth.middleware';
import { getDb } from '../plugins/mariadb';
import { getRedis } from '../plugins/redis';

const BOOTSTRAP_ADMIN_EMAIL = 'enguillem@gmail.com';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).max(100),
  phone: z.string().trim().max(30).nullable().optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

const updateProfileSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(2).max(100).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  current_password: z.string().optional(),
  new_password: z.string().min(8).optional()
}).superRefine((data, ctx) => {
  if (data.new_password && !data.current_password) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Current password is required to set a new password',
      path: ['current_password']
    });
  }
});

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/auth/register', async (request, reply) => {
    const body = registerSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: body.error.flatten() });
    }

    const email = body.data.email.trim().toLowerCase();
    const { password, name } = body.data;
    const phone = body.data.phone && body.data.phone.trim() ? body.data.phone.trim() : null;
    const role = email === BOOTSTRAP_ADMIN_EMAIL ? 'admin' : 'user';
    const db = getDb();
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if ((existing as unknown[]).length > 0) {
      return reply.status(409).send({ error: 'Email already registered' });
    }

    const hash = await bcrypt.hash(password, 12);
    const [result] = await db.query('INSERT INTO users (email, password, name, phone, role) VALUES (?, ?, ?, ?, ?)', [
      email,
      hash,
      name,
      phone,
      role
    ]);

    const userId = (result as { insertId: number }).insertId;
    const token = jwt.sign({ userId, email, role }, config.JWT_SECRET, { expiresIn: '8h' });
    return reply.status(201).send({ token, user: { id: userId, email, name, phone, role } });
  });

  fastify.post('/auth/login', async (request, reply) => {
    const body = loginSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: body.error.flatten() });
    }

    const email = body.data.email.trim().toLowerCase();
    const { password } = body.data;
    const db = getDb();
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    const users = rows as Array<{ id: number; email: string; password: string; name: string; phone: string | null; role: string }>;

    if (!users.length || !(await bcrypt.compare(password, users[0].password))) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const user = users[0];
    if (user.email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL && user.role !== 'admin') {
      await db.query("UPDATE users SET role = 'admin' WHERE id = ?", [user.id]);
      user.role = 'admin';
    }
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      config.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return { token, user: { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role } };
  });

  fastify.post('/auth/logout', { preHandler: authenticate }, async (request) => {
    const token = request.headers.authorization!.slice(7);
    await getRedis().set(`revoked:${token}`, '1', { EX: 8 * 3600 });
    return { ok: true };
  });

  fastify.get('/auth/me', { preHandler: authenticate }, async (request) => {
    const db = getDb();
    const [rows] = await db.query('SELECT id, email, name, phone, role, created_at FROM users WHERE id = ?', [
      request.user.userId
    ]);
    return (rows as unknown[])[0];
  });

  fastify.patch('/auth/me', { preHandler: authenticate }, async (request, reply) => {
    const body = updateProfileSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: body.error.flatten() });
    }

    const db = getDb();
    const [rows] = await db.query('SELECT id, email, password, name, phone, role FROM users WHERE id = ?', [
      request.user.userId
    ]);
    const user = (rows as Array<{ id: number; email: string; password: string; name: string; phone: string | null; role: 'user' | 'admin' }>)[0];
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    const updates: Record<string, string | null> = {};

    if (body.data.email) {
      const normalizedEmail = body.data.email.trim().toLowerCase();
      const [existing] = await db.query('SELECT id FROM users WHERE email = ? AND id <> ?', [normalizedEmail, user.id]);
      if ((existing as unknown[]).length) {
        return reply.status(409).send({ error: 'Email already in use' });
      }
      updates.email = normalizedEmail;
    }

    if (body.data.name !== undefined) {
      updates.name = body.data.name;
    }

    if (body.data.phone !== undefined) {
      updates.phone = body.data.phone && body.data.phone.trim() ? body.data.phone.trim() : null;
    }

    if (body.data.new_password) {
      const passwordMatches = await bcrypt.compare(body.data.current_password ?? '', user.password);
      if (!passwordMatches) {
        return reply.status(401).send({ error: 'Current password is incorrect' });
      }
      updates.password = await bcrypt.hash(body.data.new_password, 12);
    }

    if (Object.keys(updates).length) {
      await db.query(
        `UPDATE users SET ${Object.keys(updates).map((field) => `${field} = ?`).join(', ')} WHERE id = ?`,
        [...Object.values(updates), user.id]
      );
    }

    const refreshedUser = {
      id: user.id,
      email: updates.email ?? user.email,
      name: updates.name ?? user.name,
      phone: updates.phone !== undefined ? updates.phone : user.phone,
      role: user.role
    };
    const token = jwt.sign(
      { userId: refreshedUser.id, email: refreshedUser.email, role: refreshedUser.role },
      config.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return { token, user: refreshedUser };
  });
}
