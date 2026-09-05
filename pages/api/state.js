import { getPool } from '../../lib/db';
import { DEMO_USER_ID } from '../../lib/constants';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const pool = getPool();

  try {
    const catRes = await pool.query(
      'select id, name, color_idx, exclude_from_spending, archived from categories where user_id = $1 order by sort_order, created_at',
      [DEMO_USER_ID]
    );
    const categories = catRes.rows.map((r) => ({
      id: r.id,
      name: r.name,
      colorIdx: r.color_idx,
      excludeFromSpending: r.exclude_from_spending,
      archived: r.archived,
    }));

    const budgetRes = await pool.query(
      `select b.category_id, b.month, b.amount_cents
       from budgets b
       join categories c on c.id = b.category_id
       where c.user_id = $1`,
      [DEMO_USER_ID]
    );
    const budgets = {};
    budgetRes.rows.forEach((r) => {
      budgets[r.category_id + '|' + r.month] = r.amount_cents / 100;
    });

    // Single-user app for now, so this isn't scoped further — see lib/constants.js.
    const txRes = await pool.query(
      `select id, category_id, merchant, amount_cents, description, to_char(date, 'YYYY-MM-DD') as date
       from transactions
       order by date desc`
    );
    const transactions = txRes.rows.map((r) => ({
      id: r.id,
      categoryId: r.category_id,
      merchant: r.merchant,
      amount: r.amount_cents / 100,
      date: r.date,
      description: r.description,
    }));

    const itemsRes = await pool.query(
      'select id, institution_name, created_at from plaid_items order by created_at'
    );
    const plaidItems = itemsRes.rows.map((r) => ({
      id: r.id,
      institutionName: r.institution_name || 'Connected account',
    }));

    res.status(200).json({ categories, budgets, transactions, plaidItems });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load state' });
  }
}