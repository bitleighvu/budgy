import { getPool } from '../../../lib/db';
import { syncTransactionsForItem } from '../../../lib/plaidSync';
import { verifyPlaidWebhook } from '../../../lib/verifyPlaidWebhook';
import { decryptToken } from '../../../lib/crypto';
import { sendPushToAll } from '../../../lib/push';

const pool = getPool();

// Verification needs the exact raw request bytes (the signature covers
// them precisely), so we can't let Next.js auto-parse this body as JSON.
export const config = {
  api: { bodyParser: false },
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

// Plaid POSTs here whenever something changes on a linked item.
// For transactions, that mostly means webhook_code === 'SYNC_UPDATES_AVAILABLE'.
// This is the server-side counterpart to the "Simulate transaction" button
// in the prototype — every new charge lands here as categoryId = null,
// and the "to categorize" screen picks it up from there.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await readRawBody(req);

  // Sandbox doesn't sign webhooks the same way production does, so
  // verification is enforced only once you're actually live. Never skip
  // this in production — it's the only thing stopping anyone who finds
  // this URL from POSTing fake payloads.
  if (process.env.PLAID_ENV === 'production') {
    const signedJwt = req.headers['plaid-verification'];
    if (!signedJwt) {
      console.error('[webhook] Missing Plaid-Verification header — rejecting');
      return res.status(401).json({ error: 'Missing verification header' });
    }
    try {
      await verifyPlaidWebhook(signedJwt, rawBody);
    } catch (err) {
      console.error('[webhook] Verification failed:', err.message);
      return res.status(401).json({ error: 'Webhook verification failed' });
    }
  }

  const body = JSON.parse(rawBody);
  const { webhook_type, webhook_code, item_id } = body;

  if (webhook_type === 'TRANSACTIONS' && webhook_code === 'SYNC_UPDATES_AVAILABLE') {
    try {
      const itemRes = await pool.query(
        'select access_token, cursor from plaid_items where item_id = $1',
        [item_id]
      );
      if (itemRes.rows.length === 0) return res.status(200).end();
      const access_token = decryptToken(itemRes.rows[0].access_token);

      const result = await syncTransactionsForItem(pool, access_token, itemRes.rows[0].cursor);
      await pool.query(
        'update plaid_items set cursor = $1, needs_reauth = false where item_id = $2',
        [result.cursor, item_id]
      );
      if (result.added > 0) {
        const plural = result.added === 1 ? '' : 's';
        sendPushToAll({
          title: 'New transaction' + plural + ' on Budgy',
          body: 'Time to categorize ' + result.added + ' transaction' + plural,
          icon: '/budgy.jpg',
          url: '/',
        }).catch((err) => console.error('[push] failed:', err.message));
      }
      res.status(200).json({ ok: true, ...result });
    } catch (err) {
      const errorCode = err.response?.data?.error_code;
      console.error(err.response?.data || err);
      if (errorCode === 'ITEM_LOGIN_REQUIRED') {
        await pool.query('update plaid_items set needs_reauth = true where item_id = $1', [item_id]);
      }
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  } else if (webhook_type === 'ITEM' && webhook_code === 'ERROR' && body.error?.error_code === 'ITEM_LOGIN_REQUIRED') {
    // Plaid's proactive notification — arrives even without us having
    // attempted a sync yet, e.g. right after the user changes their bank
    // password.
    await pool.query('update plaid_items set needs_reauth = true where item_id = $1', [item_id]);
    res.status(200).end();
  } else {
    // Other webhook types — acknowledge and ignore for now.
    res.status(200).end();
  }
}