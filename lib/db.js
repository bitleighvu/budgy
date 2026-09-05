import { Pool } from 'pg';

let pool;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 1, // serverless: Supabase's pooler (port 6543) handles pooling across invocations
    });
  }
  return pool;
}