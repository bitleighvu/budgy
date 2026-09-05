# budgy

Budgy is a mobile-first personal budgeting app that connects to your real bank and credit card accounts via the Plaid API, automatically pulling in new transactions for you to categorize and track against monthly budgets. It's built as a single-user application by design — this lets it run on Plaid's free Trial plan (up to 10 linked accounts) rather than requiring a commercial Plaid integration. Each person who deploys Budgy uses their own Plaid client_id and secret, so their own accounts stay within that 10-connection limit rather than sharing a pool with other users.

## 1. Install dependencies

```bash
npm install
```

## 2. Set up Postgres

Easiest option: a free [Supabase](https://supabase.com) project.

1. Create a project, then go to **Project Settings → Database** and copy
   the connection string (use the "Session pooler" URI if given a choice).
2. Run the schema against it:
   ```bash
   psql "<your connection string>" -f schema.sql
   psql "<your connection string>" -f seed.sql
   ```
   (`seed.sql` just creates the same 5 starter categories the prototype
   had — Groceries, Dining Out, etc. Skip it if you'd rather add your own
   from the app.)

   orrrrrr you can just run the contents of each file directly into Supabase SQL eduitor to initialize (what I did)

## 3. Get your Plaid keys

1. In the [Plaid Dashboard](https://dashboard.plaid.com), go to
   **Team Settings → Keys** and copy your `client_id` and `secret`.
2. Start with the **Sandbox** secret and `PLAID_ENV=sandbox` — Sandbox
   uses fake bank data so you can test the whole flow before touching real
   accounts. Primarily for testing you will want to use 'user_transactions_dynamic' user to test transactions. 
3. When you're ready to link your actual cards, switch to your
   **Production** secret (this is what your free Trial plan uses —
   see the note below) and set `PLAID_ENV=production`.

> Your Plaid **Trial plan** (the free tier that replaced "Development" in
> April 2026) gives you real production data for up to 10 linked
> accounts at no cost — plenty for personal use. It uses the same
> Production secret/environment as a paid plan; the Trial limits are
> enforced on Plaid's side, not by an environment flag.

Note: For Plaid connections in the trial plan, once a connection is MADE. It cannot be removed/undone, so keep this is mind to stay under the 10 connections limit. 

## 4. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in contents viewing the env.local example file 

```bash
ngrok http 3000
```

Copy the `https://...ngrok-free.app` URL it prints into `APP_URL`. Leave
the ngrok tunnel running any time you want live webhook delivery — if
it's closed, Plaid just won't be able to reach `/api/plaid/webhook`
(everything else in the app still works).

## 5. Run it

```bash
npm run dev
```

Open **http://localhost:3000** (not the ngrok URL — use ngrok's URL only
for the webhook, browse the app itself at localhost).

## 6. Test end to end

1. Click **+ CONNECT BANK ACCOUNT**. Plaid Link opens.
   - **Sandbox**: search for any institution (e.g. "Chase"), then log in
     with `user_good` / `pass_good`.
   - **Production/Trial**: log in with your real bank credentials.
2. On success, the account is stored and you're back on the dashboard.
3. New transactions don't appear instantly — Plaid syncs on its own
   schedule and then calls your webhook. To see something right away
   without waiting:
   - In **Sandbox**, trigger a test webhook manually from the
     [Plaid Dashboard → Sandbox](https://dashboard.plaid.com) (there's a
     "fire a webhook" tool), or use `/sandbox/transactions/create` via
     Plaid's API explorer to inject a fake transaction.
   - Either way, watch your terminal running `npm run dev` — you should
     see the webhook route log the sync, and the new transaction shows up
     uncategorized in the "to categorize" screen.
   - You can also just use **+ SIMULATE TRANSACTION** any time — it's
     still there, now writing to Postgres instead of local storage, and
     is genuinely useful for cash purchases Plaid will never see.
4. Categorize it, set a budget, check **VIEW ANALYTICS** — all reading
   from the same database now.

## Going to production

1. **Sign up for Plaid's Trial plan** at `dashboard.plaid.com/trial-plan` —
   for personal use this is simpler than it sounds: free, real production
   data, up to 10 linked accounts, no business registration or contract.
   Get your production `client_id`/`secret` from the Dashboard.
2. **Set your login credentials and session secret** — `AUTH_USER` /
   `AUTH_PASSWORD` (checked by the login page) and `SESSION_TOKEN`
   (generate with `openssl rand -hex 32`) in your env. `middleware.js` at
   the project root enforces this on every route except the login page
   itself and Plaid's webhook.
3. **Generate `TOKEN_ENCRYPTION_KEY`**: `openssl rand -hex 32`. Store it
   somewhere durable — losing it makes every stored `access_token`
   permanently unreadable, which means re-linking every account.
4. **Create a fresh production database** — don't reuse your dev Supabase
   project. Run `schema.sql` (and `seed.sql` if you want starter
   categories) against it.
5. **Deploy** — Vercel is the natural fit for Next.js: push to GitHub,
   import the repo, set every `.env.local` value as a Vercel environment
   variable (never commit `.env.local`), deploy. This also gives you the
   HTTPS URL Plaid's webhook requires — no more ngrok.
6. **Set `PLAID_ENV=production`** and `APP_URL` to your real deployed
   domain, then redeploy so the env vars take effect.
7. **Relink your real bank** — click "+ CONNECT BANK ACCOUNT" and log in
   with your actual credentials instead of a Sandbox test user.
8. **Delete `pages/api/plaid/sandbox-inject.js`** if you kept it from
   testing — it already no-ops outside Sandbox, but there's no reason to
   ship it.

## Not done yet (on purpose)
- **Stored stored sync cursor and daily reconciliation.** Webhook-triggered and on-load syncs are incremental now (plaid_items.cursor) — fast, since they only ask Plaid for what's changed since last time instead of the full history. The tradeoff cursors introduce: an incremental sync has no way to notice something it was never told about, so a missed webhook delivery would otherwise go uncaught. pages/api/plaid/reconcile.js is the safety net — a full resync (cursor ignored) that Vercel Cron triggers once a day (vercel.json), authenticated via CRON_SECRET rather than your login session. Requires Vercel's Cron Jobs feature to actually fire — confirm it's enabled for your plan/project, and that CRON_SECRET is set in your environment variables.
- **No push notifications yet.** The prototype's whole premise was an
  alert every time a card is used — right now you rely on opening the app
  (which syncs automatically on load). Web Push (works for iOS home-screen PWAs on 16.4+) is the
  natural next piece once the core loop above is working end to end.