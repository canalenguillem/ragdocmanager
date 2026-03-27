import multipart from '@fastify/multipart';
import staticFiles from '@fastify/static';
import cors from '@fastify/cors';
import Fastify from 'fastify';
import { config } from './config';
import { initDb } from './plugins/mariadb';
import { initMongo } from './plugins/mongodb';
import { initQdrant } from './plugins/qdrant';
import { initRedis } from './plugins/redis';
import { authRoutes } from './routes/auth';
import { documentRoutes } from './routes/documents';
import { queryRoutes } from './routes/query';
import { settingsRoutes } from './routes/settings';
import { folderRoutes } from './routes/folders';

const fastify = Fastify({ logger: true });

async function main(): Promise<void> {
  await fastify.register(cors, { origin: true, credentials: true });
  await fastify.register(multipart, {
    limits: { fileSize: Number(config.MAX_FILE_SIZE_MB) * 1024 * 1024 }
  });
  await fastify.register(staticFiles, {
    root: config.UPLOADS_PATH,
    prefix: '/uploads/'
  });

  fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  await initDb();
  await initMongo();
  await initRedis();
  await initQdrant();

  await fastify.register(authRoutes);
  await fastify.register(documentRoutes);
  await fastify.register(queryRoutes);
  await fastify.register(settingsRoutes);
  await fastify.register(folderRoutes);

  await fastify.listen({ port: Number(config.PORT), host: '0.0.0.0' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
