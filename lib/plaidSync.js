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
  let merged = 0;
  const addedMerchants = [];
  for (const t of added) {
    const acctRes = await pool.query(
      'select id from accounts where plaid_account_id = $1',
      [t.account_id]
    );
    const accountId = acctRes.rows[0]?.id || null;
    const merchant = t.merchant_name || t.name;
    const amountCents = Math.round(t.amount * 100);

    // A posted transaction Plaid has matched to an earlier pending one
    // carries pending_transaction_id, pointing at that pending row's own
    // transaction_id. Update that existing row in place (new id, final
    // amount/date, pending:false) instead of inserting a fresh row —
    // relying solely on the `removed` array to clean up the old pending
    // row isn't fully reliable on its own (per Plaid's docs, the
    // matching added/removed pair for one transition "aren't guaranteed
    // to be in the same page"), and this is the documented, direct fix
    // for exactly the pending->posted duplicate this caused. Merging in
    // place also preserves whatever category/description you'd already
    // set on the pending version, rather than losing it to a fresh
    // uncategorized insert.
    if (t.pending_transaction_id) {
      const mergeRes = await pool.query(
        `update transactions
         set plaid_transaction_id = $1, account_id = $2, merchant = $3,
             amount_cents = $4, date = $5, pending = $6
         where plaid_transaction_id = $7`,
        [t.transaction_id, accountId, merchant, amountCents, t.date, t.pending, t.pending_transaction_id]
      );
      if (mergeRes.rowCount > 0) { merged++; continue; }
      // No matching pending row found locally (never synced, or already
      // handled another way) — fall through to a normal insert below.
    }

    const insertRes = await pool.query(
      `insert into transactions
         (account_id, plaid_transaction_id, category_id, merchant, amount_cents, date, pending)
       values ($1, $2, null, $3, $4, $5, $6)
       on conflict (plaid_transaction_id) do nothing
       returning id`,
      [accountId, t.transaction_id, merchant, amountCents, t.date, t.pending]
    );
    // rowCount is 0 when ON CONFLICT DO NOTHING skipped an existing row —
    // that's the difference between "Plaid reported it" and "it's actually
    // new to our database."
    if (insertRes.rowCount > 0) {
      newlyInserted++;
      addedMerchants.push(merchant);
    }
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
    newlyInserted + ' added, ' + merged + ' merged (pending->posted), ' +
    modified.length + ' modified, ' + removedCount + ' removed.'
  );

  return { added: newlyInserted, merged, modified: modified.length, removed: removedCount, cursor };
}