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

// Syncs one item's transactions from Plaid and applies them locally.
//
// Pass `storedCursor` to do an incremental sync (only what's changed since
// that cursor — the normal fast path). Pass `undefined`/omit it to force a
// full resync from scratch, which is what the daily reconciliation job
// uses: a periodic full check that self-heals from any missed webhook
// delivery, since incremental sync alone has no way to notice something
// it was never told about.
//
// Handles all three change types Plaid reports, not just `added` — the
// original full-resync version only ever handled `added`, meaning if
// Plaid later reported an update to a transaction already in our
// database (`modified` — a settled amount, a merchant name correction)
// or a `removed` one (a reversed/duplicate charge), those changes were
// silently ignored and the database would keep stale data indefinitely.
//
// Returns the new cursor to persist, plus counts for logging/diagnostics.
export async function syncTransactionsForItem(pool, access_token, storedCursor) {
  let cursor = storedCursor || undefined;
  let added = [], modified = [], removed = [];
  let hasMore = true;
  while (hasMore) {
    const syncRes = await client.transactionsSync({ access_token, cursor });
    added = added.concat(syncRes.data.added);
    modified = modified.concat(syncRes.data.modified);
    removed = removed.concat(syncRes.data.removed);
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

  for (const t of modified) {
    const acctRes = await pool.query(
      'select id from accounts where plaid_account_id = $1',
      [t.account_id]
    );
    const accountId = acctRes.rows[0]?.id || null;
    // Deliberately doesn't touch category_id or description — those are
    // yours, not Plaid's, and an update to the underlying transaction
    // shouldn't wipe out categorization you already did.
    await pool.query(
      `update transactions
       set account_id = $1, merchant = $2, amount_cents = $3, date = $4, pending = $5
       where plaid_transaction_id = $6`,
      [accountId, t.merchant_name || t.name, Math.round(t.amount * 100), t.date, t.pending, t.transaction_id]
    );
  }

  let removedCount = 0;
  for (const t of removed) {
    const delRes = await pool.query(
      'delete from transactions where plaid_transaction_id = $1',
      [t.transaction_id]
    );
    removedCount += delRes.rowCount;
  }

  console.log(
    '[plaidSync] ' + (storedCursor ? 'incremental' : 'full') + ' sync: ' +
    newlyInserted + ' added, ' + modified.length + ' modified, ' + removedCount + ' removed.'
  );

  return { added: newlyInserted, modified: modified.length, removed: removedCount, cursor };
}