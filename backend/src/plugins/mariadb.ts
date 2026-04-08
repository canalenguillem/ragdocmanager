import mysql from 'mysql2/promise';
import { config } from '../config';

let pool: mysql.Pool;
const BOOTSTRAP_ADMIN_EMAIL = 'enguillem@gmail.com';

export function getDb(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: config.MARIADB_HOST,
      port: Number(config.MARIADB_PORT),
      database: config.MARIADB_DATABASE,
      user: config.MARIADB_USER,
      password: config.MARIADB_PASSWORD,
      waitForConnections: true,
      connectionLimit: 10,
      timezone: 'Z'
    });
  }

  return pool;
}

export async function initDb(): Promise<void> {
  const db = getDb();
  await db.query('SELECT 1');
  await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30) NULL AFTER name');
  await db.query(
    `CREATE TABLE IF NOT EXISTS document_folders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_folder_name_per_user (user_id, name),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );
  await db.query('ALTER TABLE documents ADD COLUMN IF NOT EXISTS folder_id INT NULL AFTER user_id');
  await db.query(
    "ALTER TABLE user_settings ALTER COLUMN embedding_provider SET DEFAULT 'openai'"
  );
  await db.query(
    "ALTER TABLE user_settings ALTER COLUMN embedding_model SET DEFAULT 'text-embedding-3-large'"
  );
  await db.query(
    `UPDATE user_settings us
     LEFT JOIN user_api_keys uak
       ON uak.user_id = us.user_id
      AND uak.provider = 'gemini'
      AND uak.is_active = TRUE
     SET us.embedding_provider = 'openai',
         us.embedding_model = 'text-embedding-3-large',
         us.embedding_dimensions = 3072
     WHERE us.embedding_provider = 'gemini'
       AND us.embedding_model = 'gemini-embedding-2-0'
       AND uak.id IS NULL`
  );
  await db.query(
    `UPDATE user_settings
     SET embedding_model = 'text-embedding-3-large',
         embedding_dimensions = 3072
     WHERE embedding_provider = 'openai'
       AND embedding_model NOT IN ('text-embedding-3-large', 'text-embedding-3-small', 'text-embedding-ada-002')`
  );
  await db.query("UPDATE users SET role = 'admin' WHERE LOWER(email) = ?", [BOOTSTRAP_ADMIN_EMAIL]);
  console.log('[MariaDB] Connected');
}
