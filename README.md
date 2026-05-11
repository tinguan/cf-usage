# cf-usage

> A self-hosted Cloudflare usage & cost dashboard — deployed entirely on Cloudflare (Pages + D1 + Workers).

Monitor your Cloudflare resource consumption and estimate monthly spend in real time, without giving any tool write access to your account.

<!-- Screenshots: replace the placeholders below with real images once captured -->
<!-- ![Dashboard overview](docs/screenshots/dashboard.png) -->
<!-- ![Per-worker breakdown](docs/screenshots/workers.png) -->
<!-- ![Billing history](docs/screenshots/billing.png) -->

---

## Features

### Resource monitoring
| Resource | Metrics tracked |
|---|---|
| **Workers** | Requests, CPU time (ms), subrequests — per worker |
| **R2** | Storage (GB), Class A ops (writes/lists), Class B ops (reads) |
| **KV** | Reads, writes, deletes, storage |
| **D1** | Row reads, row writes, storage (requires `d1:read` token scope) |
| **Queues** | Billable ops, bytes, messages written/read/deleted — per queue |
| **Billing** | Invoice history pulled from Cloudflare billing API |

### Cost estimation
- Calculates estimated monthly spend against Cloudflare's **Free** and **Paid** tier pricing
- Shows usage as a percentage of free-tier limits with visual indicators
- Handles overage pricing: Workers CPU, R2 operations, D1 row reads/writes, Queues ops

### Sync
- Hourly cron via a Cloudflare Worker (`cf-usage-cron`) that calls the dashboard's sync endpoint
- Configurable sync interval (1 h / 3 h / 6 h / 12 h / 24 h) from the Settings page
- Manual sync trigger from the dashboard at any time

### Auth & security
- Username/password login with session cookie (iron-session)
- All pages and API routes are protected; the cron endpoint uses a shared secret
- Read-only Cloudflare API token — no write access needed

### Alerts *(in progress)*
- Slack webhook notifications for configurable usage thresholds

---

## Architecture

```
Cloudflare Pages (Next.js, edge runtime)
│
├── /app/(app)/dashboard   — usage cards + per-worker / per-queue breakdowns
├── /app/(app)/billing     — invoice history
├── /app/(app)/alerts      — threshold alert configuration
├── /app/(app)/settings    — sync interval, credentials
│
├── /api/sync              — fetches CF GraphQL + REST APIs, writes to D1
├── /api/dashboard         — reads latest snapshots from D1 for the UI
│
└── D1 (SQLite)            — usage_snapshots, worker_snapshots, queue_snapshots,
                             billing_history, settings

cron-worker (Cloudflare Worker)
└── Scheduled: 0 * * * *  — POST /api/sync with X-Cron-Secret header
```

---

## Required API token permissions

Create a **custom token** at https://dash.cloudflare.com/profile/api-tokens with these **read-only** scopes:

| Permission | Why |
|---|---|
| Account Analytics — Read | Workers, R2, KV, D1, Queues GraphQL metrics |
| Billing — Read | Invoice history |
| Cloudflare D1 — Read | Database storage bytes |
| Cloudflare Queues — Read | Queue name mapping |

No write permissions are needed. The token never creates, modifies, or deletes any resource.

---

## Deploy to Cloudflare

### Prerequisites
- Node.js 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/): `npm install -g wrangler`
- A Cloudflare account

### 1. Clone and install

```bash
git clone https://github.com/tinguan/cloudflare_spend.git cf-usage
cd cf-usage
npm install
```

### 2. Create the D1 database

```bash
npx wrangler d1 create cf_spend
```

Copy the `database_id` output into `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "cf_spend"
database_id = "<your-database-id>"
```

### 3. Apply migrations

```bash
npx wrangler d1 migrations apply cf_spend --remote
```

### 4. Create a Cloudflare Pages project

```bash
npx wrangler pages project create cf-usage
```

### 5. Set secrets

```bash
npx wrangler pages secret put CF_API_TOKEN      --project-name cf-usage
npx wrangler pages secret put CF_ACCOUNT_ID     --project-name cf-usage
npx wrangler pages secret put CF_DASHBOARD_USER --project-name cf-usage
npx wrangler pages secret put CF_DASHBOARD_PASS --project-name cf-usage
npx wrangler pages secret put SESSION_SECRET    --project-name cf-usage
# Optional — for Slack alerts:
npx wrangler pages secret put SLACK_WEBHOOK_URL --project-name cf-usage
```

`SESSION_SECRET` must be at least 32 random characters.

### 6. Build and deploy

```bash
npm run build:cf
npx wrangler pages deploy .vercel/output/static --project-name cf-usage --branch main
```

### 7. Deploy the cron worker

```bash
cd cron-worker
npx wrangler secret put SYNC_SECRET   # same value as SESSION_SECRET
npx wrangler secret put PAGES_URL     # e.g. https://cf-usage.pages.dev
npx wrangler deploy
```

The cron fires every hour (`0 * * * *`) and calls `POST /api/sync` with the shared secret.

---

## Local development

```bash
cp .env.example .dev.vars   # fill in real values
npm run dev                 # Next.js dev server on :3000
# or
npx wrangler pages dev .vercel/output/static  # edge runtime (after build)
```

`.dev.vars` is gitignored — never commit it.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `CF_API_TOKEN` | ✅ | Cloudflare API token (read-only, see above) |
| `CF_ACCOUNT_ID` | ✅ | Your Cloudflare account ID |
| `CF_DASHBOARD_USER` | ✅ | Login username for the dashboard |
| `CF_DASHBOARD_PASS` | ✅ | Login password for the dashboard |
| `SESSION_SECRET` | ✅ | 32+ char random string for session encryption |
| `SLACK_WEBHOOK_URL` | ☑️ | Slack incoming webhook for threshold alerts |

---

## Tech stack

- **[Next.js 15](https://nextjs.org)** — App Router, edge runtime
- **[@cloudflare/next-on-pages](https://github.com/cloudflare/next-on-pages)** — Builds Next.js for Cloudflare Pages
- **[Drizzle ORM](https://orm.drizzle.team)** + **Cloudflare D1** — SQLite-compatible edge database
- **[iron-session](https://github.com/vvo/iron-session)** — Stateless encrypted session cookies
- **[shadcn/ui](https://ui.shadcn.com)** + **Tailwind CSS** — UI components
- **Cloudflare GraphQL Analytics API** — Usage metrics source
- **Cloudflare REST API** — Billing, queue names, D1 database list

---

## License

MIT — see [LICENSE](LICENSE).
