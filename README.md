# Ledger

A Next.js port of the dashboard prototype — same UI, but backed by real
Postgres data and Plaid instead of the browser's local storage. The
frontend (`pages/index.js`) is intentionally close to the original
prototype's HTML/CSS/JS: overlays, colors, and interactions are unchanged,
only the data layer now talks to `pages/api/*` instead of `window.storage`.

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

## 3. Get your Plaid keys

1. In the [Plaid Dashboard](https://dashboard.plaid.com), go to
   **Team Settings → Keys** and copy your `client_id` and `secret`.
2. Start with the **Sandbox** secret and `PLAID_ENV=sandbox` — Sandbox
   uses fake bank data (username `user_good` / password `pass_good` in
   Plaid Link) so you can test the whole flow before touching real
   accounts.
3. When you're ready to link your actual cards, switch to your
   **Production** secret (this is what your free Trial plan uses —
   see the note below) and set `PLAID_ENV=production`.

> Your Plaid **Trial plan** (the free tier that replaced "Development" in
> April 2026) gives you real production data for up to 10 linked
> accounts at no cost — plenty for personal use. It uses the same
> Production secret/environment as a paid plan; the Trial limits are
> enforced on Plaid's side, not by an environment flag.

## 4. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in:

```
PLAID_CLIENT_ID=...
PLAID_SECRET=...
PLAID_ENV=sandbox          # switch to "production" once using real keys
DATABASE_URL=...           # from step 2
APP_URL=https://<your-ngrok-subdomain>.ngrok-free.app
```

`APP_URL` matters because Plaid's webhook needs a public HTTPS URL —
`localhost` won't work. Get one with [ngrok](https://ngrok.com):

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
2. **Add `middleware.js` at the project root** (not inside `pages/`) for
   Basic Auth — this is what stops anyone but you from opening the app.
   Set `AUTH_USER` / `AUTH_PASSWORD` in your env.
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

- **Single-user only.** Every route is scoped to one fixed placeholder
  user id (`lib/constants.js`). Fine for personal use; add real
  multi-user auth (e.g. Supabase Auth) before this could ever serve more
  than one person.
- **No stored sync cursor.** Every sync (webhook-triggered, on app load, or
  the manual "SYNC NOW" button) re-checks everything Plaid currently has
  for each item rather than only what's new since last time — inserts are
  deduped via `on conflict (plaid_transaction_id) do nothing`, so this is
  safe, just wasteful once you have many items or years of history. This
  is also *why* missed webhook deliveries (e.g. this server being down
  when Plaid tried to notify it) self-heal on the next sync rather than
  losing transactions — worth keeping in mind if you later add a cursor
  for efficiency: you'd want a periodic reconcile job as a safety net for
  the same reason.
- **No push notifications yet.** The prototype's whole premise was an
  alert every time a card is used — right now you rely on opening the app
  (which syncs automatically on load) or tapping "SYNC NOW" to see new
  transactions. Web Push (works for iOS home-screen PWAs on 16.4+) is the
  natural next piece once the core loop above is working end to end.