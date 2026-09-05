-- Ledger schema — mirrors the categories / budgets / transactions
-- shape used in the dashboard prototype, plus the tables Plaid needs.

create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  created_at    timestamptz not null default now()
);

-- One row per bank connection (a Plaid "Item"). access_token must be
-- encrypted at rest in a real deployment — never store it in plaintext.
create table if not exists plaid_items (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references users(id) on delete cascade,
  item_id           text not null unique,       -- Plaid's item_id
  access_token      text not null,              -- encrypt before storing
  institution_name  text,
  created_at        timestamptz not null default now()
);

create table if not exists accounts (
  id                uuid primary key default gen_random_uuid(),
  plaid_item_id     uuid not null references plaid_items(id) on delete cascade,
  plaid_account_id  text not null unique,        -- Plaid's account_id
  name              text not null,
  mask              text,                        -- last 4 digits
  type              text,                         -- e.g. "credit"
  subtype           text                          -- e.g. "credit card"
);

create table if not exists categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  name        text not null,
  color_idx   int not null default 0,
  exclude_from_spending boolean not null default false, -- e.g. reimbursements, transfers: real transactions that shouldn't count as spend
  sort_order  int not null default 0, -- user-controlled display order on the dashboard
  archived    boolean not null default false, -- "deleting" archives instead of hard-deleting, so past transactions keep their category and don't get dumped back into the categorize queue
  created_at  timestamptz not null default now()
);

-- Budget amount for one category in one calendar month.
-- (category_id, month) is unique — matches "budgets per category per month".
create table if not exists budgets (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid not null references categories(id) on delete cascade,
  month         char(7) not null,      -- 'YYYY-MM'
  amount_cents  bigint not null,
  unique (category_id, month)
);

create table if not exists transactions (
  id                  uuid primary key default gen_random_uuid(),
  account_id          uuid references accounts(id) on delete set null,
  plaid_transaction_id text unique,     -- null for manually-added transactions
  category_id         uuid references categories(id) on delete set null, -- null = pending/uncategorized
  merchant            text not null,
  amount_cents        bigint not null,
  date                date not null,
  description         text,                    -- optional note, added by the user
  pending              boolean not null default false, -- Plaid's own pending flag (auth hold vs posted)
  created_at          timestamptz not null default now()
);

create index if not exists idx_transactions_date on transactions(date);
create index if not exists idx_transactions_category on transactions(category_id);
create index if not exists idx_budgets_month on budgets(month);