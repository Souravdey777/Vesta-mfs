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
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only and should be used only for seed/admin scripts.

## Scripts

- `npm run dev` starts the local Next.js server.
- `npm run build` creates a production build.
- `npm run start` serves the production build.
- `npm run lint` runs Next.js linting.
- `npm run typecheck` runs TypeScript without emitting files.
- `npm run test` runs unit tests with Vitest.
- `npm run test:e2e` runs Playwright tests.
- `npm run seed` will seed Supabase once the data layer is implemented.

## Supabase Setup

Supabase is the only application database. The project will use:

- `public.funds` for fund screening data.
- `public.saved_filters` for logged-in users' saved screens.
- Supabase Auth for lightweight email OTP or magic-link sign-in.
- `localStorage` as the anonymous saved-filter fallback.

Migrations and seed data are implemented in the next project phase.

## What I Deliberately Left Out

- Full account management, profiles, KYC, and brokerage identity.
- Brokerage integration or an "invest now" flow.
- Portfolio tracking.
- Live scraping during app boot.
- A comparison view.
- Free-text fund recommendations generated from model memory.

These are outside the current project scope. The core surface is conversation-to-filter translation over real fund data.
