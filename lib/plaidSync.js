import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

const client = new PlaidApi(new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
}));

// Pulls every new transaction Plaid has for this access_token and inserts
// it as uncategorized (category_id = null), same shape either way it's
// triggered from:
//   - once, right after Plaid Link succeeds — populates data immediately
//     AND is what makes Plaid start sending SYNC_UPDATES_AVAILABLE webhooks
//     for this Item going forward (Plaid won't send that webhook for an
//     Item until /transactions/sync has been called on it at least once)
//   - every time the webhook fires afterward, for ongoing updates
//
// Not storing a cursor per item yet, so this always re-syncs from scratch —
// fine at personal-app scale, see the README for what a real version needs.
export async function syncTransactionsForItem(pool, access_token) {
  let cursor = undefined;
  let added = [];
  let hasMore = true;
  while (hasMore) {
    const syncRes = await client.transactionsSync({ access_token, cursor });
    added = added.concat(syncRes.data.added);
    hasMore = syncRes.data.has_more;
    cursor = syncRes.data.next_cursor;
  }

  let newlyInserted = 0;
  for (const t of added) {
    const acctRes = await pool.query(
      'select id from accounts where plaid_account_id = $1',
      [t.account_id]
    );
    const accountId = acctRes.rows[0]?.id || null;

    const insertRes = await pool.query(
      `insert into transactions
         (account_id, plaid_transaction_id, category_id, merchant, amount_cents, date, pending)
       values ($1, $2, null, $3, $4, $5, $6)
       on conflict (plaid_transaction_id) do nothing
       returning id`,
      [
        accountId,
        t.transaction_id,
        t.merchant_name || t.name,
        Math.round(t.amount * 100),
        t.date,
        t.pending,
      ]
    );
    // rowCount is 0 when ON CONFLICT DO NOTHING skipped an existing row —
    // that's the difference between "Plaid reported it" and "it's actually
    // new to our database."
    if (insertRes.rowCount > 0) newlyInserted++;
  }

  console.log(
    '[plaidSync] Plaid returned ' + added.length + ' transaction(s) for this item, ' +
    newlyInserted + ' were new (' + (added.length - newlyInserted) + ' already existed).'
  );

  return newlyInserted;
}