# MF Screener AI

Conversational mutual fund screening for Indian investors. Users describe what they want in plain English, the assistant translates that into structured filters, and the fund table remains the source of truth.

Deployed URL: TBD

## Tech Stack

- Next.js 14 App Router
- TypeScript strict mode
- Tailwind CSS
- shadcn/ui component conventions
- Anthropic Claude Sonnet via official SDK
- Zustand
- Supabase Postgres and Supabase Auth
- Vitest and Playwright

## Getting Started

Install dependencies:

```bash
npm install
```

Create an environment file:

```bash
cp .env.example .env.local
```

Run the development server:

```bash
npm run dev
```

Open http://localhost:3000.

## Environment Variables

```bash
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-20250514
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
AMFI_NAV_URL=https://www.amfiindia.com/spages/NAVAll.txt
MF_DATA_API_BASE_URL=https://mfdata.in/api/v1
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only and should be used only for seed/admin scripts.
`CRON_SECRET` protects the Vercel Cron refresh route.
`ANTHROPIC_MODEL` is optional; the chat route defaults to Claude Sonnet 4 if it is omitted.

## Scripts

- `npm run dev` starts the local Next.js server.
- `npm run build` creates a production build.
- `npm run start` serves the production build.
- `npm run lint` runs Next.js linting.
- `npm run typecheck` runs TypeScript without emitting files.
- `npm run test` runs unit tests with Vitest.
- `npm run test:e2e` runs Playwright tests.
- `npm run seed:dry-run` validates the sample AMFI NAV fixture and enrichment join without writing.
- `npm run seed` fetches AMFI NAV data and upserts rows into Supabase.
- `npm run seed -- --enrichment-source=mfdata` fetches actual AUM, expense ratio, rating, and category enrichment from mfdata.in.
- `npm run seed -- --enrichment-source=mfdata --mfdata-full` also fetches actual returns, Sharpe, standard deviation, beta, minimum SIP, and exit load where mfdata.in has coverage.

## Fund Query API

`GET /api/funds` reads from Supabase and returns paged fund rows with the active normalized filters:

```bash
/api/funds?category=Large%20Cap&min_returns_3y=15&page=1&pageSize=25
```

Supported filters mirror the chat tool state: category, AUM floor, expense-ratio cap, return floors, rolling 3-year return floor, Sharpe floor, volatility cap, beta cap, upside/downside capture filters, rating floor, fund house, plan type, sort field, and order. Invalid query params return `400` with sanitized validation issues. Empty result sets return zero-state metadata with suggested filters to relax.

## Chat API

`POST /api/chat` streams provider-neutral server-sent events. The server proposes text and complete tool calls; the browser applies those tool calls to the single Zustand filter store and then refreshes fund results.

SSE events are `text_delta`, `tool_call`, `done`, and `error`. Tool calls are emitted only after Anthropic finishes each streamed tool-use block, so the client never applies partial JSON.

## Saved Filters

Anonymous saved screens are stored in `localStorage` under `mfscreener.saved_filters`. When a Supabase session is active, the same dropdown reads and writes `public.saved_filters` through the anon client and RLS policies.

If local anonymous saves exist after sign-in, the dropdown offers to sync them. Non-conflicting names can be imported, while matching normalized names require an explicit keep-cloud, overwrite-cloud, or rename-local choice.

## UI

The home page is the working screener: chat drives tool calls, filters refresh `/api/funds`, chips can remove filters directly, and the fund table expands rows for return snapshots, advanced performance/risk metrics, and exit-load details. The chat panel includes Supabase magic-link sign-in; `/auth/callback` exchanges the link code and returns to the screener.

## Advanced Metrics

The demo fixture includes curated enrichment fields for rolling 3-year returns, Sharpe ratio, standard deviation, beta, upside capture ratio, and downside capture ratio. These live in `data/enriched-funds.seed.json` and are useful for offline development.

For actual enrichment, use `--enrichment-source=mfdata`. mfdata.in provides actual AUM, TER, ratings, return windows, Sharpe, standard deviation, beta, minimum SIP, and exit load for covered schemes. True rolling returns and upside/downside capture are left `null` unless a real source or historical computation pipeline is added.

AMFI remains the NAV source. A production version should compute missing rolling/capture metrics from historical fund NAVs and benchmark TRI data, or use a licensed data provider.

## Supabase Setup

Supabase is the only application database. The project will use:

- `public.funds` for fund screening data.
- `public.saved_filters` for logged-in users' saved screens.
- Supabase Auth for lightweight email OTP or magic-link sign-in.
- `localStorage` as the anonymous saved-filter fallback.

### 1. Create the hosted project

Create a new Supabase project from the Supabase dashboard. Copy the project URL, anon key, and service-role key into `.env.local`.

### 2. Apply migrations

Open the Supabase SQL Editor and run the SQL in:

```bash
supabase/migrations/001_create_funds_and_saved_filters.sql
supabase/migrations/002_add_advanced_fund_metrics.sql
```

The migrations create:

- `public.funds`, with public read-only access for fund data.
- Advanced nullable metric columns on `public.funds`.
- `public.saved_filters`, with RLS policies so users can only access their own saved filters.
- `public.set_updated_at()`, used to maintain `saved_filters.updated_at`.

If you prefer the Supabase CLI, apply the same migrations through your linked project after installing and configuring the CLI.

For a direct Postgres connection, you can also run:

```bash
SUPABASE_DB_URL="postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres" npm run db:migrate
```

Do not commit the database URL. It contains the database password.

### 3. Configure Auth

In Supabase Auth settings:

- Enable email OTP or magic-link sign-in.
- Add `http://localhost:3000/auth/callback` to redirect URLs.
- Add `https://<your-vercel-domain>/auth/callback` after deployment.

No profiles, KYC, brokerage identity, or full account management is required. Auth exists only to sync saved filters for logged-in users.

### 4. Seed fund data

Validate the parser and demo enrichment join locally:

```bash
npm run seed:dry-run
```

Upsert fund rows into Supabase:

```bash
npm run seed
```

By default, dry-run uses `data/amfi-nav.sample.txt` so it works offline. The real seed command fetches the AMFI bulk NAV file, merges `data/enriched-funds.seed.json`, and upserts by `scheme_code`. Missing enrichment values are stored as `null`; ingestion does not fetch thousands of per-scheme API calls during app boot.

### 5. Configure Vercel Cron

`vercel.json` schedules the protected refresh route:

```json
{
  "path": "/api/cron/refresh-funds",
  "schedule": "0 20 * * *"
}
```

Vercel cron expressions run in UTC. This schedule runs daily at 20:00 UTC, which is 1:30 AM IST the next day, giving a buffer after daily NAV publication.

Set these environment variables in Vercel:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
AMFI_NAV_URL=https://www.amfiindia.com/spages/NAVAll.txt
MF_DATA_API_BASE_URL=https://mfdata.in/api/v1
```

For local route testing, call:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3000/api/cron/refresh-funds?dryRun=1&source=sample"
```

The app reads from Supabase only. External NAV data is used by seed and cron ingestion, not during normal user traffic.

## What I Deliberately Left Out

- Full account management, profiles, KYC, and brokerage identity.
- Brokerage integration or an "invest now" flow.
- Portfolio tracking.
- Live scraping during app boot.
- Live computed rolling/risk analytics; the current advanced metrics are demo fixtures.
- A comparison view.
- Free-text fund recommendations generated from model memory.

These are outside the current project scope. The core surface is conversation-to-filter translation over real fund data.
