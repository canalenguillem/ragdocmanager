import { RedisClientType, createClient } from 'redis';
import { config } from '../config';

let redisClient: RedisClientType;

export async function initRedis(): Promise<void> {
  redisClient = createClient({
    socket: { host: config.REDIS_HOST, port: Number(config.REDIS_PORT) },
    password: config.REDIS_PASSWORD
  }) as RedisClientType;

  redisClient.on('error', (err) => console.error('[Redis] Error:', err));
  await redisClient.connect();
  console.log('[Redis] Connected');
}

export function getRedis(): RedisClientType {
  if (!redisClient) {
    throw new Error('Redis not initialized');
  }

  return redisClient;
}
