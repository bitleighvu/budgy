// Run with: node --env-file=.env.local scripts/get-access-token.mjs
// (Requires Node 20.6+ for --env-file. On older Node, export
// DATABASE_URL and TOKEN_ENCRYPTION_KEY in your shell first instead,
// then run: node scripts/get-access-token.mjs)
import { Pool } from 'pg';
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey() {
  const keyHex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!keyHex) throw new Error('TOKEN_ENCRYPTION_KEY is not set');
  return Buffer.from(keyHex, 'hex');
}

function decryptToken(stored) {
  const [ivHex, authTagHex, dataHex] = stored.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const res = await pool.query(
  'select item_id, institution_name, access_token, created_at from plaid_items order by created_at desc'
);

if (res.rows.length === 0) {
  console.log('No linked bank accounts found.');
} else {
  for (const row of res.rows) {
    console.log('---');
    console.log('Institution:  ', row.institution_name);
    console.log('Item ID:      ', row.item_id);
    console.log('Linked:       ', row.created_at);
    console.log('Access token: ', decryptToken(row.access_token));
  }
}

await pool.end();
