# MF Screener

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

## Fund Query API

`GET /api/funds` reads from Supabase and returns paged fund rows with the active normalized filters:

```bash
/api/funds?category=Large%20Cap&min_returns_3y=15&page=1&pageSize=25
```

Supported filters mirror the chat tool state: category, AUM floor, expense-ratio cap, return floors, rating floor, fund house, plan type, sort field, and order. Invalid query params return `400` with sanitized validation issues. Empty result sets return zero-state metadata with suggested filters to relax.

## Chat API

`POST /api/chat` streams provider-neutral server-sent events. The server proposes text and complete tool calls; the browser applies those tool calls to the single Zustand filter store and then refreshes fund results.

SSE events are `text_delta`, `tool_call`, `done`, and `error`. Tool calls are emitted only after Anthropic finishes each streamed tool-use block, so the client never applies partial JSON.

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
```

The migration creates:

- `public.funds`, with public read-only access for fund data.
- `public.saved_filters`, with RLS policies so users can only access their own saved filters.
- `public.set_updated_at()`, used to maintain `saved_filters.updated_at`.

If you prefer the Supabase CLI, apply the same migration through your linked project after installing and configuring the CLI.

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

By default, dry-run uses `data/amfi-nav.sample.txt` so it works offline. The real seed command fetches the AMFI bulk NAV file, merges `data/enriched-funds.seed.json`, and upserts by `scheme_code`.

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
- A comparison view.
- Free-text fund recommendations generated from model memory.

These are outside the current project scope. The core surface is conversation-to-filter translation over real fund data.
