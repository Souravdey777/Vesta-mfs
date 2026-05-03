# agent.md - MF Screener

> Instructions for AI coding agents (Claude Code, Cursor, Copilot, etc.) working on this codebase.

---

## 1. Project Context

**Product**: A Claude.ai-style conversational interface for screening Indian mutual funds. Users describe what they want in plain English ("show me large cap funds with >15% 3-year returns and expense ratio under 1%"), and the agent applies filters in real-time via function calling, updating a fund table side-by-side with the chat.

**Why it exists**: Indian investors choose from 5,000+ mutual funds. Existing screeners (Moneycontrol, Groww, Value Research) demand that users already know the exact filter taxonomy: "AUM," "Sharpe ratio," "category vs sub-category," "direct vs regular plan." The product hypothesis is that a conversational layer over a structured screener lowers the barrier for first-time and second-time investors without removing the power of filter-based screening.

**Target user**: Young professionals (25 to 40) in India, salaried, with some investing literacy (knows what an SIP is) but not an analyst (does not know what "rolling alpha" means). They want to act, not learn jargon.

**Built for**: Zamp engineering project round. Scope is 5 days. Velocity matters.

---

## 2. The Single Most Important Rule

The agent updates a structured filter state via function calling. It does not generate fund recommendations as free text.

When a user says "show me good large cap funds," the LLM does NOT respond with a markdown list of fund names from its training data. It calls `apply_filters({ category: "Large Cap", sort_by: "returns_3y", order: "desc" })` and the React table re-renders from real Supabase data.

This separation matters because:
1. Mutual fund data changes daily. LLM training data is stale and often wrong on AUM, NAV, and returns.
2. Hallucinated fund names erode trust faster than any UX flaw.
3. The interesting product surface is the conversation-to-filter mapping, not the LLM's recall.

If you find yourself writing a prompt that asks Claude to "list the top 5 funds," stop. The LLM's job is filter translation and explanation. The Supabase data layer's job is the funds.

---

## 3. Architecture (intended)

```text
Frontend (Next.js + React)
  Chat Panel (left, ~40%)          Fund Table (right, ~60%)
         |                                  ^
         | user message                     | filter state (Zustand)
         v                                  |
  /api/chat (Next.js route)                 |
    - calls Anthropic API                   |
    - tools: apply_filters,                 |
             clear_filters,                 |
             explain_metric,                |
             save_filter,                   |
             load_saved_filter,             |
             list_saved_filters             |
    - streams response                      |
         | tool_use blocks                  |
         v                                  |
  Client applies tool calls to Zustand -----+
         |
         v
  /api/funds?filters=...
    - validates filters
    - queries Supabase Postgres
    - returns filtered funds

Supabase
  - Postgres table: public.funds
  - Postgres table: public.saved_filters for logged-in users
  - Supabase Auth for lightweight email or magic-link sign-in
  - SQL migrations committed in supabase/migrations
  - Seeded from AMFI NAV file + static enriched dataset
  - No live scraping during normal app boot
```

Frontend owns filter state. The LLM proposes filter changes via tool calls. The frontend applies them and re-fetches funds from `/api/funds`, which queries Supabase server-side. Saved filters are persisted to Supabase for logged-in users and to localStorage for anonymous users. This keeps the LLM stateless and the UI authoritative.

---

## 4. Tech Stack and Why

| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | Next.js 14 (App Router) | One repo, API routes, Vercel deploy in one click. Velocity. |
| LLM | Anthropic Claude Sonnet via official SDK | Tool use is first-class and reliable. Streaming works well. |
| State | Zustand | Smaller than Redux, no boilerplate, fits a 5-day build. |
| DB | Supabase Postgres via `@supabase/supabase-js` | Managed Postgres, easy seed/migration workflow, simple Vercel env setup, and no local SQLite/prod Postgres split. |
| Auth | Supabase Auth | Lightweight sign-in only for syncing saved filters across devices. No full account system. |
| Styling | Tailwind + shadcn/ui | Default Claude-style aesthetic without bikeshedding. |
| Tests | Vitest + Playwright | Vitest for unit, Playwright for one end-to-end happy path. |
| Deploy | Vercel + Supabase | Fast hosted frontend plus managed database. No custom infra. |

Do not switch any of these without a written reason in the README. Velocity over preference. Do not add SQLite or `better-sqlite3`; Supabase is the source of truth for fund data.

---

## 5. Function Calling Contract

Define exactly these tools. Do not add more without updating this file.

### `apply_filters`

Applies one or more filter changes to the current filter state. Filters are additive unless `replace: true`.

```ts
{
  category?: "Large Cap" | "Mid Cap" | "Small Cap" | "Flexi Cap" | "ELSS" | "Hybrid" | "Debt" | "Index"
  min_aum_cr?: number          // AUM in crores
  max_expense_ratio?: number   // percent, e.g. 1.0
  min_returns_1y?: number      // percent
  min_returns_3y?: number
  min_returns_5y?: number
  min_rolling_returns_3y?: number
  min_sharpe_ratio?: number
  max_standard_deviation?: number
  max_beta?: number
  min_upside_capture_ratio?: number
  max_downside_capture_ratio?: number
  min_rating?: 1 | 2 | 3 | 4 | 5
  fund_house?: string          // e.g. "HDFC", "Axis"
  plan_type?: "Direct" | "Regular"
  sort_by?: "returns_1y" | "returns_3y" | "returns_5y" | "rolling_returns_3y" | "sharpe_ratio" | "standard_deviation" | "beta" | "upside_capture_ratio" | "downside_capture_ratio" | "aum" | "expense_ratio" | "rating"
  order?: "asc" | "desc"
  replace?: boolean            // if true, clear existing filters first
}
```

### `clear_filters`

Empties the filter state. No arguments.

### `explain_metric`

Returns a plain-English explanation of a fund metric to render as an inline chat message. This is the one tool where the LLM produces user-facing prose.

```ts
{
  metric: "expense_ratio" | "aum" | "rolling_returns_3y" | "sharpe_ratio" | "standard_deviation" | "alpha" | "beta" | "upside_capture_ratio" | "downside_capture_ratio" | "exit_load" | "category_definition"
  context?: string  // optional, for personalised explanations
}
```

The model is instructed to call `explain_metric` whenever the user asks "what is X" rather than answering from memory, so the explanations are consistent and reviewable.

### `save_filter`

Saves the current filter state under a user-given name. Logged-in users persist saved filters to Supabase under their user id. Anonymous users persist saved filters to `localStorage`.

```ts
{
  name: string  // e.g. "retirement", "tax saving", "high growth"
}
```

The frontend reads the live filter state from the Zustand store at save time. The LLM does not pass the filter contents; it only proposes the save and the name. This keeps the saved data authoritative on the client and avoids the LLM hallucinating filter values into the saved record.

Storage rules:
- If the user is logged in, save to `public.saved_filters` in Supabase.
- If the user is anonymous, save to `localStorage` under `mfscreener.saved_filters`.
- If an anonymous user signs in later, offer to sync local saved filters to Supabase. Do not sync silently if it would overwrite a server-side save with the same name.

If a save with the same name already exists, the frontend prompts the user to overwrite. The chat surfaces this as a confirmation step, not a tool round-trip.

### `load_saved_filter`

Loads a saved filter set by name and replaces the current filter state.

```ts
{
  name: string
}
```

The frontend resolves the name against the active saved-filter source: Supabase for logged-in users, `localStorage` for anonymous users. If the name is not found, the chat replies with the available saved names rather than guessing. Fuzzy matching is allowed (case-insensitive, trim whitespace) but not aggressive (no Levenshtein, no "did you mean").

### `list_saved_filters`

Returns the list of saved filter names so the LLM can answer "what have I saved?" without inventing names. No arguments.

---

## 6. System Prompt (canonical)

Keep this in `lib/prompts.ts`. Do not edit casually.

```text
You are MF Screener, a conversational assistant that helps Indian investors screen mutual funds.

You have access to six tools: apply_filters, clear_filters, explain_metric, save_filter, load_saved_filter, list_saved_filters.

RULES:
1. Never name specific funds or quote returns, AUM, or NAV from memory. The fund table on the right is the source of truth.
2. When the user describes what they want, translate it into apply_filters. Do not ask permission for obvious mappings.
3. When the user asks "what is X" about a financial metric, call explain_metric.
4. When the user asks for a recommendation, do not pick a fund. Apply sensible filters and tell them what you filtered for and why.
5. Be brief. Two to four sentences in chat. The table does the heavy lifting.
6. If the user's request is ambiguous (e.g. "good funds"), make one reasonable interpretation, apply it, and say what you chose. Do not ask three clarifying questions.
7. Do not give tax or investment advice. You filter; the user decides.
8. When the user says "save this" or "save as X," call save_filter. If they don't give a name, propose one based on the current filters (e.g. "large cap high growth") and ask for confirmation in one short sentence.
9. When the user references a saved screen by name ("show me my retirement screen"), call load_saved_filter. If you don't know whether a name exists, call list_saved_filters first.
```

Rule 6 is the most important UX rule. Asking clarifying questions in a screener feels like a slow lawyer. Pick a reasonable default and move.

---

## 7. Data

### Source

Primary: AMFI NAVAll.txt (free, daily, official). https://www.amfiindia.com/spages/NAVAll.txt

Enriched: scraped or manually curated returns, ratings, expense ratios, AUM, and category from Value Research, Moneycontrol, or mfdata.in. For offline development, ship with a static enriched dataset. For actual database enrichment, use `npm run seed -- --enrichment-source=mfdata`; add `--mfdata-full` when you need returns, Sharpe, standard deviation, beta, minimum SIP, and exit load where mfdata.in has coverage. Never fill missing metrics with invented estimates.

### Supabase Setup

Use Supabase Postgres as the only application database.

- Commit SQL migrations in `supabase/migrations`.
- Keep seed inputs in `data/` or `supabase/seed.sql`.
- Implement `npm run seed` as an idempotent script that upserts into `public.funds`.
- Use `SUPABASE_SERVICE_ROLE_KEY` only in server-side seed/admin scripts. Never expose it to the browser.
- Use `/api/funds` for fund reads from the app. The client should not assemble Supabase queries directly for screening.
- Use Supabase Auth for lightweight saved-filter sync. Prefer email OTP or magic-link sign-in. Do not build profiles, passwords, or social auth unless the README explains why.
- Browser Supabase clients must use only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, with RLS policies enforcing per-user access.

### Schema

```sql
create extension if not exists pgcrypto;

create table public.funds (
  scheme_code text primary key,
  scheme_name text not null,
  fund_house text not null,
  category text not null,
  sub_category text,
  plan_type text not null check (plan_type in ('Direct', 'Regular')),
  nav numeric(12, 4) not null,
  aum_cr numeric(14, 2),
  expense_ratio numeric(5, 2),
  returns_1y numeric(6, 2),
  returns_3y numeric(6, 2),
  returns_5y numeric(6, 2),
  rolling_returns_3y numeric(6, 2),
  sharpe_ratio numeric(6, 2),
  standard_deviation numeric(6, 2),
  beta numeric(6, 2),
  upside_capture_ratio numeric(6, 2),
  downside_capture_ratio numeric(6, 2),
  rating integer check (rating between 1 and 5),
  min_sip integer,
  exit_load text,
  updated_at timestamptz not null
);

create index idx_funds_category on public.funds(category);
create index idx_funds_aum on public.funds(aum_cr);
create index idx_funds_plan_type on public.funds(plan_type);
create index idx_funds_returns_3y on public.funds(returns_3y);

create table public.saved_filters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  normalized_name text generated always as (lower(btrim(name))) stored,
  filters jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, normalized_name)
);

create index idx_saved_filters_user_id on public.saved_filters(user_id);

alter table public.saved_filters enable row level security;

create policy "Users can read their saved filters"
on public.saved_filters
for select
using (auth.uid() = user_id);

create policy "Users can insert their saved filters"
on public.saved_filters
for insert
with check (auth.uid() = user_id);

create policy "Users can update their saved filters"
on public.saved_filters
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their saved filters"
on public.saved_filters
for delete
using (auth.uid() = user_id);
```

For public read-only fund data, either keep reads behind `/api/funds` with a server Supabase client or enable RLS with a narrow `select` policy for the anon role. Do not disable RLS casually on tables that may later hold user data.

For `public.saved_filters`, RLS is mandatory. A user must never be able to read, update, or delete another user's saved filter.

### Saved filters

Logged-in users store saved filters in Supabase:

```ts
type SavedFilterRow = {
  id: string
  user_id: string
  name: string
  normalized_name: string
  filters: FilterState
  created_at: string
  updated_at: string
}
```

Anonymous users store saved filters in `localStorage` under `mfscreener.saved_filters` as:

```ts
type SavedFilters = Record<string, {
  filters: FilterState   // same shape Zustand holds
  created_at: string     // ISO timestamp
  updated_at: string
}>
```

Keys and `normalized_name` values are user-given names, lowercased and trimmed. The Zustand store hydrates this on mount and writes through on every save/delete. For logged-in users, hydration reads Supabase first and then optionally offers to sync any anonymous local saves. For anonymous users, hydration reads localStorage only.

---

## 8. UX Decisions (what to build, what to skip)

**Build**:
1. Split-pane layout: chat left, fund table right. On mobile, chat-first with a "show results" CTA that swaps to the table.
2. Filter chips above the table showing currently applied filters. Each chip is dismissable. The LLM is not the only way to remove filters.
3. Streaming responses with visible "applying filter..." status when a tool call is in flight.
4. A "starter prompts" row when the chat is empty. Three or four examples like "Show me tax-saving funds with strong 3-year returns" or "I want to invest 5000 a month, suggest a category."
5. Click a fund row to expand: full metrics, returns chart placeholder, exit load.
6. Saved filters dropdown above the filter chips. Shows "Save current view" when there are active filters and a list of saved screens with a delete affordance per row. Logged-in users save to Supabase. Anonymous users save to `localStorage` under key `mfscreener.saved_filters`. Empty state explains the concept in one sentence ("Save a set of filters and reload it from the chat or this menu").
7. Lightweight sign-in entry point in the saved filters menu. Use Supabase Auth email OTP or magic link. The CTA should be about syncing saved screens, not about creating an investing account.

**Skip** (and say so in the README):
1. Full account management. No profile page, password settings, KYC, avatars, social graph, or brokerage identity. Supabase Auth exists only so logged-in users can sync saved filters.
2. Real brokerage integration. No "invest now" button.
3. Portfolio tracking. Out of scope.
4. Live NAV refresh. Static daily snapshot in Supabase is fine.
5. SEBI risk-o-meter graphic. Show category, skip the chart.
6. Comparison view (multi-fund side-by-side). Nice to have, not core.

The README's "what I deliberately left out" section is graded. Do not skip it.

---

## 9. Code Conventions

- TypeScript strict mode. No `any` without a `// eslint-disable-next-line` and a comment explaining why.
- Server-only code lives in `app/api/` or `lib/server/`. Never import server modules into client components.
- Anthropic SDK calls only happen in `app/api/chat/route.ts`. Never expose the API key to the client.
- Supabase server clients live in `lib/server/supabase.ts`. Do not create ad hoc Supabase clients inside route handlers.
- The service-role key is allowed only in server-only seed/admin code. It must never appear in client components, hooks, browser bundles, logs, or README examples with real values.
- Browser-safe Supabase code lives in `lib/supabase/browser.ts` and uses only public anon env vars.
- Auth/session helpers live in `lib/supabase/auth.ts` or `lib/server/auth.ts`. Prefer `@supabase/ssr` for Next.js App Router cookie handling.
- Client saved-filter persistence helpers live in `lib/saved-filters.ts`. They must choose Supabase for authenticated users and localStorage for anonymous users.
- Server saved-filter helpers, if needed, live in `lib/server/saved-filters.ts` and must never touch localStorage.
- One Zustand store: `lib/store/filters.ts`. Do not create a second store.
- Components in `components/` are presentational. Data fetching happens in `hooks/use-funds.ts`, which calls `/api/funds`.
- The fund query builder should live in `lib/server/funds-query.ts` and translate `FilterState` into a validated Supabase query or RPC params.
- File names: kebab-case for files, PascalCase for components, camelCase for functions.
- No CSS files outside `globals.css`. Tailwind only.

---

## 10. Testing

This is graded. "Token coverage" is explicitly called out as not enough.

**Required**:
1. Unit tests on the filter reducer. Every tool call shape should produce the expected next state. Cover `replace: true`, additive filters, and conflicting sorts.
2. Unit tests on the Supabase fund query builder. Given a filter object, the generated query/RPC parameters should be correct, safe, and equivalent to the intended SQL. If raw SQL is used inside an RPC, it must be parameterised and tested.
3. One Playwright end-to-end: open the app, type "large cap funds with >15% 3-year returns," wait for the table to update, assert that visible rows match the filter. Use a test Supabase project, local Supabase, or mocked `/api/funds`; document which one in the README.
4. A test that the system prompt's rules hold: feed the LLM "what is the best HDFC fund right now" in a test harness and assert the response does not contain a specific scheme name. Use a recorded response or a cheap model in test mode.
5. Unit tests on the saved-filters store: save, overwrite (same name), delete, and load-by-unknown-name should each behave as documented. Cover both anonymous localStorage persistence and logged-in Supabase persistence with mocked Supabase calls.
6. A seed-script test or dry-run fixture that proves `npm run seed` upserts stable rows into the Supabase schema without duplicating funds.
7. A saved-filters RLS test or documented SQL smoke test proving one user cannot read or mutate another user's saved filters.

**Not required**: 100% coverage. Snapshot tests of UI. Tests of the Anthropic SDK itself.

---

## 11. Deployment

- Vercel for the Next.js app. `main` auto-deploys.
- Supabase for Postgres. Apply migrations before first deploy and seed once via `npm run seed`.
- Environment variables:
  - `ANTHROPIC_API_KEY`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (server-only, seed/admin scripts only)
- Do not commit real Supabase keys. Put placeholder values in `.env.example`.
- Configure Supabase Auth redirect URLs for local dev and the deployed Vercel URL.
- Add the deployed URL and Supabase setup notes to the README at the top.

---

## 12. Things That Will Trip You Up

1. **Streaming + tool use**: Anthropic's streaming API emits tool_use blocks incrementally. Do not try to apply filters mid-stream. Wait for `message_stop` or accumulate the full tool_use block before dispatching.
2. **Supabase secrets**: `NEXT_PUBLIC_*` keys are visible to the browser. The service-role key bypasses RLS and must stay server-only.
3. **Supabase RLS**: Decide early whether funds are read through `/api/funds` only or through anon read policies. Do not mix both styles casually.
4. **Auth state timing**: Saved filters may hydrate before the Supabase session is ready. Show a loading state or fall back deliberately; do not flicker between two different saved-filter lists.
5. **Saved-filter conflicts**: Anonymous localStorage saves can conflict with Supabase saves after sign-in. Prompt before overwriting and keep the server copy authoritative if the user cancels.
6. **AMFI text format**: It is a pipe-delimited file with section headers between fund houses. Parse defensively.
7. **Returns data is not in AMFI**: You will need a second source. Decide early whether to scrape, use a free API, or hand-curate. Do not start the build assuming AMFI alone is enough.
8. **Indian number formatting**: Crores, lakhs, percentages with two decimals. Format consistently. Use the Indian rupee symbol in UI, not "Rs."
9. **Category names are not standardised**: SEBI categories vs AMC marketing names diverge. Pick SEBI's 36 categories as canonical and map aggressively.
10. **Numeric sorting from Supabase**: Store returns, AUM, NAV, and expense ratio as numeric columns. Do not sort formatted strings.

---

## 13. What "Insanely Great" Looks Like Here

The brief calls out velocity and depth. Surface the depth in two places:

1. **The filter-translation layer**. If a user says "I want stable funds for retirement," that should map to something thoughtful (low-volatility category, high AUM, multi-year track record), not a literal keyword search. Document the mapping logic and explain it in the README.
2. **The empty state and error state**. When the filters return zero funds, do not show a blank table. Have the chat explain what was filtered out and propose a relaxation. ("No funds matched. The 5-year return floor of 25% is unusual; want me to lower it to 20%?")

These are the two places most candidates skip. They are the two places product instinct is visible.

---

## 14. Out-of-Scope Reminders for Agents

If a prompt asks you to:

- Add full user accounts, profiles, KYC, or brokerage identity -> push back, link to section 8. Lightweight Supabase Auth for saved filters is allowed.
- Integrate with a brokerage -> push back, link to section 8.
- Switch from Anthropic to OpenAI -> push back, link to section 4.
- Switch from Supabase to SQLite or another database -> push back, link to section 4.
- Add a second Zustand store -> push back, link to section 9.
- Generate fund recommendations as text -> push back, link to section 2.

Do not silently comply. The scope is part of the evaluation.
