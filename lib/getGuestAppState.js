import { getPool } from './db';
import { resetGuestData } from './guestSeed';

export async function getGuestAppState() {
  const pool = getPool();

  const catRes = await pool.query(
    'select id, name, color_idx, exclude_from_spending, archived from guest_categories order by sort_order, created_at'
  );
  // If this is the very first visit ever (tables genuinely empty), seed
  // it on the fly rather than showing a blank demo.
  if (catRes.rows.length === 0) {
    await resetGuestData(pool);
    return getGuestAppState();
  }

  const categories = catRes.rows.map((r) => ({
    id: r.id,
    name: r.name,
    colorIdx: r.color_idx,
    excludeFromSpending: r.exclude_from_spending,
    archived: r.archived,
  }));

  const budgetRes = await pool.query('select category_id, month, amount_cents from guest_budgets');
  const budgets = {};
  budgetRes.rows.forEach((r) => {
    budgets[r.category_id + '|' + r.month] = r.amount_cents / 100;
  });

  const txRes = await pool.query(
    `select id, category_id, merchant, amount_cents, description, to_char(date, 'YYYY-MM-DD') as date
     from guest_transactions order by date desc`
  );
  const transactions = txRes.rows.map((r) => ({
    id: r.id,
    categoryId: r.category_id,
    merchant: r.merchant,
    amount: r.amount_cents / 100,
    date: r.date,
    description: r.description,
  }));

  return { categories, budgets, transactions, plaidItems: [] };
}
