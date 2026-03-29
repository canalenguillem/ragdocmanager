import crypto from 'crypto';
import { config } from '../config';
import { getDb } from '../plugins/mariadb';
import { EmbeddingProvider, UserSettings } from '../types';
import { EmbedConfig, EMBEDDING_MODELS, embedTexts } from './embedding.service';

const ALGO = 'aes-256-cbc';
const KEY = Buffer.from(config.API_KEY_ENCRYPTION_SECRET, 'hex');

function encrypt(text: string): Buffer {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, encrypted]);
}

function decrypt(data: Buffer): string {
  const iv = data.subarray(0, 16);
  const encrypted = data.subarray(16);
  const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

export async function saveApiKey(
  userId: number,
  provider: EmbeddingProvider,
  keyType: 'embedding' | 'chat' | 'both',
  rawKey: string
): Promise<void> {
  const db = getDb();
  const encrypted = encrypt(rawKey);
  await db.query(
    `INSERT INTO user_api_keys (user_id, provider, key_type, api_key)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE api_key = VALUES(api_key), is_active = TRUE, updated_at = NOW()`,
    [userId, provider, keyType, encrypted]
  );
}

export async function getApiKey(
  userId: number,
  provider: EmbeddingProvider,
  keyType: 'embedding' | 'chat' | 'both' = 'both'
): Promise<string | null> {
  const db = getDb();
  const [rows] = await db.query(
    `SELECT api_key FROM user_api_keys
     WHERE user_id = ? AND provider = ? AND key_type IN (?, 'both') AND is_active = TRUE
     ORDER BY FIELD(key_type, ?, 'both') LIMIT 1`,
    [userId, provider, keyType, keyType]
  );
  const result = rows as Array<{ api_key: Buffer }>;
  if (!result.length) {
    return null;
  }

  return decrypt(result[0].api_key);
}

export async function listApiKeys(userId: number) {
  const db = getDb();
  const [rows] = await db.query(
    'SELECT id, provider, key_type, is_active, verified_at, created_at FROM user_api_keys WHERE user_id = ?',
    [userId]
  );
  return rows;
}

export async function deleteApiKey(userId: number, keyId: number): Promise<void> {
  const db = getDb();
  await db.query('DELETE FROM user_api_keys WHERE id = ? AND user_id = ?', [keyId, userId]);
}

export async function verifyApiKey(
  userId: number,
  provider: EmbeddingProvider,
  rawKey: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const models = EMBEDDING_MODELS[provider];
    if (!models?.length) {
      return { ok: false, error: 'Unknown provider' };
    }

    await embedTexts(['test'], { provider, model: models[0].model, apiKey: rawKey });
    const db = getDb();
    await db.query(
      'UPDATE user_api_keys SET verified_at = NOW() WHERE user_id = ? AND provider = ? AND is_active = TRUE',
      [userId, provider]
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Verification failed' };
  }
}

export async function getEmbedConfig(userId: number): Promise<EmbedConfig> {
  const settings = await getUserSettings(userId);
  const apiKey = await getApiKey(userId, settings.embedding_provider, 'embedding');
  const resolvedKey = apiKey ?? getFallbackKey(settings.embedding_provider);
  if (!resolvedKey) {
    throw new Error(`No API key for "${settings.embedding_provider}". Please add one in Settings → API Keys.`);
  }

  return { provider: settings.embedding_provider, model: settings.embedding_model, apiKey: resolvedKey };
}

export async function getChatApiKey(
  userId: number
): Promise<{ provider: string; model: string; apiKey: string }> {
  const settings = await getUserSettings(userId);
  const apiKey = await getApiKey(userId, settings.chat_provider as EmbeddingProvider, 'chat');
  const resolvedKey = apiKey ?? getFallbackKey(settings.chat_provider as EmbeddingProvider);
  if (!resolvedKey) {
    throw new Error(`No API key for chat provider "${settings.chat_provider}". Please add one in Settings → API Keys.`);
  }

  return { provider: settings.chat_provider, model: settings.chat_model, apiKey: resolvedKey };
}

export async function getUserSettings(userId: number): Promise<UserSettings> {
  const db = getDb();
  const [rows] = await db.query('SELECT * FROM user_settings WHERE user_id = ?', [userId]);
  const result = rows as UserSettings[];
  if (result.length) {
    const settings = result[0];
    const providerModels = EMBEDDING_MODELS[settings.embedding_provider] ?? [];
    const selectedModel = providerModels.find((model) => model.model === settings.embedding_model);

    if (providerModels.length > 0 && !selectedModel) {
      const fallbackModel = providerModels[0];
      await db.query(
        `UPDATE user_settings
         SET embedding_model = ?, embedding_dimensions = ?
         WHERE user_id = ?`,
        [fallbackModel.model, fallbackModel.dimensions, userId]
      );

      return {
        ...settings,
        embedding_model: fallbackModel.model,
        embedding_dimensions: fallbackModel.dimensions
      };
    }

    return settings;
  }

  await db.query(
    `INSERT IGNORE INTO user_settings (
      user_id, embedding_provider, embedding_model, chat_provider, chat_model, embedding_dimensions
    ) VALUES (?, 'openai', 'text-embedding-3-large', 'openai', 'gpt-4o', 3072)`,
    [userId]
  );
  return {
    user_id: userId,
    embedding_provider: 'openai',
    embedding_model: 'text-embedding-3-large',
    chat_provider: 'openai',
    chat_model: 'gpt-4o',
    embedding_dimensions: 3072
  };
}

export async function updateUserSettings(userId: number, settings: Partial<UserSettings>): Promise<void> {
  const db = getDb();
  const allowed = ['embedding_provider', 'embedding_model', 'chat_provider', 'chat_model', 'embedding_dimensions'];
  const fields = Object.keys(settings).filter((key) => allowed.includes(key));
  if (!fields.length) {
    return;
  }

  const values = fields.map((field) => (settings as Record<string, unknown>)[field]);
  await db.query(
    `INSERT INTO user_settings (user_id, ${fields.join(', ')}) VALUES (?, ${fields.map(() => '?').join(', ')})
     ON DUPLICATE KEY UPDATE ${fields.map((field) => `${field} = VALUES(${field})`).join(', ')}`,
    [userId, ...values]
  );
}

function getFallbackKey(provider: EmbeddingProvider): string | undefined {
  switch (provider) {
    case 'gemini':
      return config.GEMINI_API_KEY;
    case 'openai':
      return config.OPENAI_API_KEY;
    default:
      return undefined;
  }
}
