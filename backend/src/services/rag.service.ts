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
  history: Array<{ question: string; answer: string }>,
  provider: string,
  model: string,
  apiKey: string
): Promise<string> {
  const prompt = `Contexto:\n${context}\n\nPregunta: ${question}`;
  const historyMessages = history.flatMap((entry) => ([
    { role: 'user' as const, content: entry.question },
    { role: 'assistant' as const, content: entry.answer }
  ]));

  if (provider === 'openai') {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...historyMessages,
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
    const historyText = history.length
      ? `Conversación previa:\n${history.map((entry, index) => `Turno ${index + 1}\nUsuario: ${entry.question}\nAsistente: ${entry.answer}`).join('\n\n')}\n\n`
      : '';
    const result = await genModel.generateContent(`${historyText}${prompt}`);
    return result.response.text();
  }

  throw new Error(`Chat provider "${provider}" not supported.`);
}

export async function runRagQuery(
  question: string,
  userId: number,
  documentIds?: number[],
  conversationId?: string
): Promise<QueryResponse> {
  const resolvedConversationId = conversationId ?? uuidv4();
  const embedCfg = await getEmbedConfig(userId);
  const [queryVector] = await embedTexts([question], embedCfg);
  const results = await searchSimilar(queryVector, userId, documentIds, 5);

  if (!results.length) {
    return {
      answer: 'No he encontrado información relevante en los documentos disponibles.',
      sources: [],
      query_id: uuidv4(),
      conversation_id: resolvedConversationId
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
  const history = await getMongo()
    .collection('query_history')
    .find({ user_id: userId, conversation_id: resolvedConversationId })
    .sort({ created_at: 1 })
    .limit(12)
    .project({ question: 1, answer: 1, _id: 0 })
    .toArray() as Array<{ question: string; answer: string }>;
  const answer = await generateAnswer(context, question, history, chatCfg.provider, chatCfg.model, chatCfg.apiKey);

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
    conversation_id: resolvedConversationId,
    user_id: userId,
    question,
    answer,
    sources,
    document_ids: documentIds?.length ? documentIds : docIds,
    title: history.length ? history[0].question.slice(0, 120) : question.slice(0, 120),
    embedding_provider: embedCfg.provider,
    chat_provider: chatCfg.provider,
    created_at: new Date()
  });

  return { answer, sources, query_id: queryId, conversation_id: resolvedConversationId };
}
