import { FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { getRedis } from '../plugins/redis';
import { JwtPayload } from '../types';

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    void reply.status(401).send({ error: 'Unauthorized' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
    const revoked = await getRedis().get(`revoked:${token}`);
    if (revoked) {
      void reply.status(401).send({ error: 'Token revoked' });
      return;
    }

    request.user = payload;
  } catch {
    void reply.status(401).send({ error: 'Invalid token' });
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    user: JwtPayload;
  }
}
