import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../plugins/mariadb';
import { getMongo } from '../plugins/mongodb';
import { QueryResponse, Source } from '../types';
import { getChatApiKey, getEmbedConfig } from './apikeys.service';
import { embedTexts } from './embedding.service';
import { searchSimilar } from './qdrant.service';

const SYSTEM_PROMPT = `Eres un asistente experto en análisis de documentos técnicos y legales.
Responde ÚNICAMENTE basándote en el contexto proporcionado.
Si la información no está en el contexto, indícalo claramente.
Responde en el mismo idioma que la pregunta.
Sé preciso y cita las fuentes por número cuando sea relevante.`;

async function generateAnswer(
  context: string,
  question: string,
  provider: string,
  model: string,
  apiKey: string
): Promise<string> {
  const prompt = `Contexto:\n${context}\n\nPregunta: ${question}`;

  if (provider === 'openai') {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 1000
    });
    return completion.choices[0].message.content ?? 'No se pudo generar respuesta.';
  }

  if (provider === 'gemini') {
    const genai = new GoogleGenerativeAI(apiKey);
    const genModel = genai.getGenerativeModel({
      model,
      systemInstruction: SYSTEM_PROMPT
    });
    const result = await genModel.generateContent(prompt);
    return result.response.text();
  }

  throw new Error(`Chat provider "${provider}" not supported.`);
}

export async function runRagQuery(
  question: string,
  userId: number,
  documentIds?: number[]
): Promise<QueryResponse> {
  const embedCfg = await getEmbedConfig(userId);
  const [queryVector] = await embedTexts([question], embedCfg);
  const results = await searchSimilar(queryVector, userId, documentIds, 5);

  if (!results.length) {
    return {
      answer: 'No he encontrado información relevante en los documentos disponibles.',
      sources: [],
      query_id: uuidv4()
    };
  }

  const context = results
    .map((result, index) => `[Fuente ${index + 1}] (Página ${result.payload.page_number}): ${String(result.payload.text)}`)
    .join('\n\n');

  const db = getDb();
  const docIds = [...new Set(results.map((result) => Number(result.payload.document_id)))];
  const [docs] = await db.query(
    `SELECT id, original_name FROM documents WHERE id IN (${docIds.map(() => '?').join(',')})`,
    docIds
  );
  const docMap = new Map(
    (docs as Array<{ id: number; original_name: string }>).map((doc) => [doc.id, doc.original_name])
  );

  const chatCfg = await getChatApiKey(userId);
  const answer = await generateAnswer(context, question, chatCfg.provider, chatCfg.model, chatCfg.apiKey);

  const sources: Source[] = results.map((result) => ({
    document_id: Number(result.payload.document_id),
    document_name: docMap.get(Number(result.payload.document_id)) ?? 'Desconocido',
    page_number: Number(result.payload.page_number),
    bbox: result.payload.bbox as Source['bbox'],
    text: String(result.payload.text),
    score: result.score
  }));

  const queryId = uuidv4();
  await getMongo().collection('query_history').insertOne({
    query_id: queryId,
    user_id: userId,
    question,
    answer,
    sources,
    embedding_provider: embedCfg.provider,
    chat_provider: chatCfg.provider,
    created_at: new Date()
  });

  return { answer, sources, query_id: queryId };
}
