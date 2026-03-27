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
  await db.query("UPDATE users SET role = 'admin' WHERE LOWER(email) = ?", [BOOTSTRAP_ADMIN_EMAIL]);
  console.log('[MariaDB] Connected');
}
