import mysql from 'mysql2/promise';
import { config } from '../config';

let pool: mysql.Pool;

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
  console.log('[MariaDB] Connected');
}
