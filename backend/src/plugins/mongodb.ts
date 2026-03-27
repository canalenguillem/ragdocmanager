import { Db, MongoClient } from 'mongodb';
import { config } from '../config';

let client: MongoClient;
let db: Db;

export async function initMongo(): Promise<void> {
  const uri = `mongodb://${config.MONGO_USER}:${config.MONGO_PASSWORD}@${config.MONGO_HOST}:${config.MONGO_PORT}/${config.MONGO_DATABASE}?authSource=admin`;
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(config.MONGO_DATABASE);

  await db.collection('document_chunks').createIndex({ document_id: 1, user_id: 1 });
  await db.collection('document_chunks').createIndex({ qdrant_point_id: 1 }, { unique: true });
  await db.collection('query_history').createIndex({ user_id: 1, created_at: -1 });
  await db.collection('query_history').createIndex({ user_id: 1, conversation_id: 1, created_at: -1 });

  console.log('[MongoDB] Connected');
}

export function getMongo(): Db {
  if (!db) {
    throw new Error('MongoDB not initialized');
  }

  return db;
}
