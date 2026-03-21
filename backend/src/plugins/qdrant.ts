import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from '../config';

let qdrantClient: QdrantClient;

export async function initQdrant(): Promise<void> {
  qdrantClient = new QdrantClient({
    host: config.QDRANT_HOST,
    port: Number(config.QDRANT_PORT)
  });

  const collections = await qdrantClient.getCollections();
  const exists = collections.collections.some((collection) => collection.name === config.QDRANT_COLLECTION);

  if (!exists) {
    await qdrantClient.createCollection(config.QDRANT_COLLECTION, {
      vectors: { size: 3072, distance: 'Cosine' }
    });
    await qdrantClient.createPayloadIndex(config.QDRANT_COLLECTION, {
      field_name: 'user_id',
      field_schema: 'integer'
    });
    await qdrantClient.createPayloadIndex(config.QDRANT_COLLECTION, {
      field_name: 'document_id',
      field_schema: 'integer'
    });
    console.log(`[Qdrant] Collection '${config.QDRANT_COLLECTION}' created`);
  }

  console.log('[Qdrant] Connected');
}

export function getQdrant(): QdrantClient {
  if (!qdrantClient) {
    throw new Error('Qdrant not initialized');
  }

  return qdrantClient;
}
