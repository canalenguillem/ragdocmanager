import { config } from '../config';
import { getQdrant } from '../plugins/qdrant';
import { TextChunk } from '../types';

export async function upsertChunks(
  chunks: TextChunk[],
  embeddings: number[][],
  documentId: number,
  userId: number
): Promise<void> {
  const points = chunks.map((chunk, index) => ({
    id: chunk.pointId,
    vector: embeddings[index],
    payload: {
      document_id: documentId,
      user_id: userId,
      chunk_index: chunk.chunkIndex,
      page_number: chunk.page,
      text: chunk.text,
      bbox: chunk.bbox
    }
  }));

  for (let i = 0; i < points.length; i += 100) {
    await getQdrant().upsert(config.QDRANT_COLLECTION, {
      points: points.slice(i, i + 100),
      wait: true
    });
  }
}

export async function searchSimilar(
  queryVector: number[],
  userId: number,
  documentIds?: number[],
  topK = 5
): Promise<Array<{ score: number; payload: Record<string, unknown> }>> {
  const filter: Record<string, unknown> = {
    must: [{ key: 'user_id', match: { value: userId } }]
  };

  if (documentIds?.length) {
    (filter.must as unknown[]).push({
      key: 'document_id',
      match: { any: documentIds }
    });
  }

  const results = await getQdrant().search(config.QDRANT_COLLECTION, {
    vector: queryVector,
    limit: topK,
    filter,
    with_payload: true
  });

  return results.map((result) => ({
    score: result.score,
    payload: result.payload as Record<string, unknown>
  }));
}

export async function deleteDocumentVectors(documentId: number): Promise<void> {
  await getQdrant().delete(config.QDRANT_COLLECTION, {
    filter: { must: [{ key: 'document_id', match: { value: documentId } }] },
    wait: true
  });
}
