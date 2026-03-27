import fs from 'fs';
import path from 'path';
import { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { authenticate } from '../middleware/auth.middleware';
import { getDb } from '../plugins/mariadb';
import { getMongo } from '../plugins/mongodb';
import { extractPdfData } from '../services/pdf.service';
import { embedTexts } from '../services/embedding.service';
import { deleteDocumentVectors, upsertChunks } from '../services/qdrant.service';

export async function documentRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/documents', async (request) => {
    const db = getDb();
    const [rows] = await db.query(
      'SELECT id, original_name, file_size, page_count, status, error_msg, created_at, updated_at, embedding_provider, embedding_model, folder_id FROM documents WHERE user_id = ? ORDER BY created_at DESC',
      [request.user.userId]
    );
    return rows;
  });

  fastify.post('/documents/upload', async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'No file provided' });
    }

    if (data.mimetype !== 'application/pdf') {
      return reply.status(400).send({ error: 'Only PDF files are allowed' });
    }

    const maxBytes = Number(config.MAX_FILE_SIZE_MB) * 1024 * 1024;
    const filename = `${uuidv4()}.pdf`;
    const filePath = path.join(config.UPLOADS_PATH, filename);
    fs.mkdirSync(config.UPLOADS_PATH, { recursive: true });

    let fileSize = 0;
    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      fileSize += chunk.length;
      if (fileSize > maxBytes) {
        return reply.status(413).send({ error: `File exceeds ${config.MAX_FILE_SIZE_MB}MB limit` });
      }

      chunks.push(chunk);
    }

    fs.writeFileSync(filePath, Buffer.concat(chunks));

    const db = getDb();
    const [result] = await db.query(
      'INSERT INTO documents (user_id, filename, original_name, file_size) VALUES (?, ?, ?, ?)',
      [request.user.userId, filename, data.filename, fileSize]
    );
    const documentId = (result as { insertId: number }).insertId;
    void processDocument(documentId, request.user.userId, filePath);

    return reply.status(202).send({ id: documentId, status: 'pending' });
  });

  fastify.get<{ Params: { id: string } }>('/documents/:id', async (request, reply) => {
    const db = getDb();
    const [rows] = await db.query('SELECT * FROM documents WHERE id = ? AND user_id = ?', [
      request.params.id,
      request.user.userId
    ]);
    if (!(rows as unknown[]).length) {
      return reply.status(404).send({ error: 'Not found' });
    }

    return (rows as unknown[])[0];
  });

  fastify.get<{ Params: { id: string } }>('/documents/:id/status', async (request, reply) => {
    const db = getDb();
    const [rows] = await db.query(
      'SELECT id, status, error_msg, page_count FROM documents WHERE id = ? AND user_id = ?',
      [request.params.id, request.user.userId]
    );
    if (!(rows as unknown[]).length) {
      return reply.status(404).send({ error: 'Not found' });
    }

    return (rows as unknown[])[0];
  });

  fastify.get<{ Params: { id: string } }>('/documents/:id/file', async (request, reply) => {
    const db = getDb();
    const [rows] = await db.query('SELECT filename FROM documents WHERE id = ? AND user_id = ?', [
      request.params.id,
      request.user.userId
    ]);
    if (!(rows as unknown[]).length) {
      return reply.status(404).send({ error: 'Not found' });
    }

    const doc = (rows as Array<{ filename: string }>)[0];
    return reply.sendFile(doc.filename, config.UPLOADS_PATH);
  });

  fastify.delete<{ Params: { id: string } }>('/documents/:id', async (request, reply) => {
    const db = getDb();
    const [rows] = await db.query('SELECT filename FROM documents WHERE id = ? AND user_id = ?', [
      request.params.id,
      request.user.userId
    ]);
    if (!(rows as unknown[]).length) {
      return reply.status(404).send({ error: 'Not found' });
    }

    const doc = (rows as Array<{ filename: string }>)[0];
    const filePath = path.join(config.UPLOADS_PATH, doc.filename);
    await deleteDocumentVectors(Number(request.params.id));
    await getMongo().collection('document_chunks').deleteMany({ document_id: Number(request.params.id) });
    await db.query('DELETE FROM documents WHERE id = ?', [request.params.id]);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return { ok: true };
  });
}

async function processDocument(documentId: number, userId: number, filePath: string): Promise<void> {
  const db = getDb();
  await db.query('UPDATE documents SET status = ? WHERE id = ?', ['processing', documentId]);

  try {
    const { getEmbedConfig } = await import('../services/apikeys.service');
    const { chunks, pageCount } = await extractPdfData(filePath);
    if (!chunks.length) {
      throw new Error('No text could be extracted from PDF');
    }

    const embedCfg = await getEmbedConfig(userId);
    const batchSize = embedCfg.provider === 'gemini' ? 5 : 20;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const embeddings = await embedTexts(batch.map((chunk) => chunk.text), embedCfg);
      allEmbeddings.push(...embeddings);
    }

    await upsertChunks(chunks, allEmbeddings, documentId, userId);

    const mongoDocs = chunks.map((chunk) => ({
      document_id: documentId,
      user_id: userId,
      chunk_index: chunk.chunkIndex,
      text: chunk.text,
      page_number: chunk.page,
      bbox: chunk.bbox,
      qdrant_point_id: chunk.pointId
    }));
    await getMongo().collection('document_chunks').insertMany(mongoDocs);

    await db.query(
      'UPDATE documents SET status = ?, page_count = ?, embedding_provider = ?, embedding_model = ? WHERE id = ?',
      ['ready', pageCount, embedCfg.provider, embedCfg.model, documentId]
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await db.query('UPDATE documents SET status = ?, error_msg = ? WHERE id = ?', ['error', message, documentId]);
  }
}
