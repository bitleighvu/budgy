import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { getPool } from '../../../lib/db';
import { DEMO_USER_ID } from '../../../lib/constants';
import { syncTransactionsForItem } from '../../../lib/plaidSync';
import { encryptToken } from '../../../lib/crypto';

const client = new PlaidApi(new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
}));

const pool = getPool();

// Called once, right after the person finishes the Plaid Link flow.
// Swaps the short-lived public_token for a long-lived access_token,
// which is what every future /transactions call will use.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { public_token, userId, institutionName } = req.body;

    const exchange = await client.itemPublicTokenExchange({ public_token });
    const { access_token, item_id } = exchange.data;

    await pool.query(
      `insert into plaid_items (user_id, item_id, access_token, institution_name)
       values ($1, $2, $3, $4)`,
      [userId || DEMO_USER_ID, item_id, encryptToken(access_token), institutionName || null]
    );

    const accountsRes = await client.accountsGet({ access_token });
    for (const acct of accountsRes.data.accounts) {
      await pool.query(
        `insert into accounts (plaid_item_id, plaid_account_id, name, mask, type, subtype)
         select id, $2, $3, $4, $5, $6 from plaid_items where item_id = $1
         on conflict (plaid_account_id) do nothing`,
        [item_id, acct.account_id, acct.name, acct.mask, acct.type, acct.subtype]
      );
    }

    // Plaid won't start sending SYNC_UPDATES_AVAILABLE webhooks for this
    // Item until /transactions/sync has been called on it at least once —
    // this call both starts that webhook stream AND pulls in the first
    // batch of transactions immediately, so the dashboard isn't empty
    // while you wait for the first webhook.
    const addedCount = await syncTransactionsForItem(pool, access_token);

    res.status(200).json({ ok: true, added: addedCount });
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).json({ error: 'Failed to link account' });
  }
}