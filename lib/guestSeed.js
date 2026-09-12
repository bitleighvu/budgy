// Fake, generic data for the guest demo — no relation to real spending
// whatsoever. Dates are computed relative to "now" at reset time so the
// demo always looks current (this month + last month) no matter when
// someone resets it, rather than drifting into the past.

const CATEGORY_DEFS = [
  { name: 'Groceries', colorIdx: 0, exclude: false },
  { name: 'Dining Out', colorIdx: 1, exclude: false },
  { name: 'Transportation', colorIdx: 2, exclude: false },
  { name: 'Entertainment', colorIdx: 3, exclude: false },
  { name: 'Rent', colorIdx: 4, exclude: false },
  { name: 'Utilities', colorIdx: 5, exclude: false },
];

const BUDGETS_BY_CATEGORY = {
  Groceries: 500,
  'Dining Out': 200,
  Transportation: 150,
  Entertainment: 80,
  Rent: 1800,
  Utilities: 180,
};

function ymd(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function monthKey(y, m) {
  return `${y}-${String(m).padStart(2, '0')}`;
}

// [categoryName, merchant, amount, dayOfMonth] — categoryName null means
// left uncategorized on purpose, so the guest has something to try the
// categorize flow on immediately.
function txnDefsForMonth() {
  return [
    ['Groceries', 'Trader Joe\'s', 64.23, 3],
    ['Groceries', 'Whole Foods', 91.47, 14],
    ['Groceries', 'Safeway', 52.10, 24],
    ['Dining Out', 'Chipotle', 13.85, 5],
    ['Dining Out', 'Blue Bottle Coffee', 6.50, 9],
    ['Dining Out', 'Thai Basil', 38.90, 18],
    ['Transportation', 'Uber', 22.14, 7],
    ['Transportation', 'Shell Gas Station', 45.00, 20],
    ['Entertainment', 'Netflix', 15.49, 1],
    ['Entertainment', 'AMC Theatres', 28.00, 12],
    ['Rent', 'Sunset Apartments', 1800.00, 1],
    ['Utilities', 'PG&E', 84.32, 10],
    ['Utilities', 'Comcast', 79.99, 15],
    [null, 'Target', 47.62, 22],
    [null, 'Amazon', 33.15, 27],
    [null, 'Doordash', 24.80, 29],
  ];
}

export async function resetGuestData(pool) {
  await pool.query('truncate table guest_transactions, guest_budgets, guest_categories cascade');

  const now = new Date();
  const thisY = now.getFullYear(), thisM = now.getMonth() + 1;
  const lastDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastY = lastDate.getFullYear(), lastM = lastDate.getMonth() + 1;

  const catIds = {};
  for (let i = 0; i < CATEGORY_DEFS.length; i++) {
    const c = CATEGORY_DEFS[i];
    const res = await pool.query(
      `insert into guest_categories (name, color_idx, exclude_from_spending, sort_order)
       values ($1, $2, $3, $4) returning id`,
      [c.name, c.colorIdx, c.exclude, i]
    );
    catIds[c.name] = res.rows[0].id;
  }

  for (const [name, amount] of Object.entries(BUDGETS_BY_CATEGORY)) {
    const cents = Math.round(amount * 100);
    await pool.query(
      `insert into guest_budgets (category_id, month, amount_cents) values ($1, $2, $3)`,
      [catIds[name], monthKey(thisY, thisM), cents]
    );
    await pool.query(
      `insert into guest_budgets (category_id, month, amount_cents) values ($1, $2, $3)`,
      [catIds[name], monthKey(lastY, lastM), cents]
    );
  }

  const txns = txnDefsForMonth();
  for (const [catName, merchant, amount, day] of txns) {
    const catId = catName ? catIds[catName] : null;
    await pool.query(
      `insert into guest_transactions (category_id, merchant, amount_cents, date, description)
       values ($1, $2, $3, $4, $5)`,
      [catId, merchant, Math.round(amount * 100), ymd(thisY, thisM, day), null]
    );
    // A lighter set for last month too, so "By month"/Analytics has more
    // than one data point to actually show.
    if (catName) {
      await pool.query(
        `insert into guest_transactions (category_id, merchant, amount_cents, date, description)
         values ($1, $2, $3, $4, $5)`,
        [catId, merchant, Math.round(amount * 0.9 * 100), ymd(lastY, lastM, day), null]
      );
    }
  }
}
