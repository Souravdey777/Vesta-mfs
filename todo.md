# MF Screener Todo

## 1. Project Setup

- [x] Scaffold Next.js 14 app with App Router and TypeScript strict mode.
- [x] Add Tailwind and shadcn/ui.
- [x] Install core dependencies: Anthropic SDK, Zustand, Supabase client, validation library, Vitest, Playwright.
- [x] Create `.env.example` with Supabase and Anthropic placeholders.
- [x] Add README with setup, scripts, deployed URL placeholder, and deliberate tradeoffs.

## 2. Supabase Data Layer

- [x] Create Supabase project.
- [x] Add `public.funds` migration.
- [x] Add `public.saved_filters` migration with RLS policies.
- [x] Configure Supabase Auth email OTP or magic-link flow.
- [x] Add seed input files for AMFI NAV data and enriched fund metrics.
- [x] Implement idempotent `npm run seed` to upsert fund rows.
- [x] Document local and production Supabase setup in README.

## 3. Core Types And State

- [x] Define `FilterState`, fund row, tool-call, and saved-filter types.
- [x] Implement single Zustand store in `lib/store/filters.ts`.
- [x] Support additive filter updates.
- [x] Support `replace: true`.
- [x] Support chip removal and clear-all behavior.
- [x] Support saved-filter hydration for anonymous and logged-in users.

## 4. Fund Query API

- [ ] Build filter validation for `/api/funds`.
- [ ] Implement Supabase fund query builder in `lib/server/funds-query.ts`.
- [ ] Add filters for category, AUM, expense ratio, returns, rating, fund house, and plan type.
- [ ] Add sorting for returns, AUM, expense ratio, and rating.
- [ ] Return zero-state metadata when no funds match.
- [ ] Format errors without exposing Supabase internals.

## 5. Chat And Tool Calling

- [ ] Add canonical system prompt in `lib/prompts.ts`.
- [ ] Implement `/api/chat` with Anthropic Sonnet.
- [ ] Define tools: `apply_filters`, `clear_filters`, `explain_metric`, `save_filter`, `load_saved_filter`, `list_saved_filters`.
- [ ] Accumulate streamed tool-use blocks before applying tool results.
- [ ] Prevent free-text fund recommendations from the assistant.
- [ ] Add metric explanations through `explain_metric`.

## 6. Saved Filters

- [ ] Save anonymous filters to `localStorage` under `mfscreener.saved_filters`.
- [ ] Save logged-in user filters to `public.saved_filters`.
- [ ] List saved filters from the active source.
- [ ] Load saved filters by normalized name.
- [ ] Prompt before overwriting duplicate names.
- [ ] Offer to sync anonymous saves after sign-in.
- [ ] Resolve sync conflicts without silently overwriting Supabase data.
- [ ] Add delete saved filter action in the dropdown.

## 7. UI

- [ ] Build split-pane desktop layout with chat left and table right.
- [ ] Build mobile chat-first layout with results view toggle.
- [ ] Add starter prompts for empty chat.
- [ ] Add streaming and tool-call status states.
- [ ] Add filter chips above table.
- [ ] Add saved filters dropdown and sign-in CTA.
- [ ] Build fund table with expandable rows.
- [ ] Add returns chart placeholder and exit-load details.
- [ ] Add thoughtful empty state with suggested filter relaxation.

## 8. Formatting And UX Polish

- [ ] Format Indian currency, crores, lakhs, and percentages consistently.
- [ ] Keep chat responses to two to four sentences.
- [ ] Avoid investment or tax advice.
- [ ] Ensure no fund names are generated from model memory.
- [ ] Add loading, error, and zero-result states.
- [ ] Verify responsive layout for desktop and mobile.

## 9. Tests

- [x] Unit test filter reducer for every tool shape.
- [x] Cover additive filters, `replace: true`, and conflicting sorts.
- [ ] Unit test Supabase query builder output or RPC params.
- [x] Unit test saved filters for anonymous localStorage flow.
- [x] Unit test saved filters for logged-in Supabase flow with mocked client.
- [ ] Add RLS smoke test or documented SQL verification for `public.saved_filters`.
- [ ] Add seed dry-run test to prevent duplicate fund rows.
- [ ] Add Playwright happy path for large-cap funds with 3-year returns over 15%.
- [ ] Add prompt-safety test for "best HDFC fund right now".

## 10. Deployment

- [ ] Configure Vercel project.
- [ ] Add Supabase env vars to Vercel.
- [ ] Configure Supabase Auth redirect URLs for localhost and Vercel.
- [ ] Apply migrations to production Supabase.
- [ ] Seed production Supabase once.
- [ ] Add deployed URL to README.
- [ ] Run final build and test suite before submission.

## 11. Do Not Build

- [ ] Do not add brokerage integration.
- [ ] Do not add portfolio tracking.
- [ ] Do not add full user profiles or KYC.
- [ ] Do not add live scraping during app boot.
- [ ] Do not switch away from Anthropic or Supabase without documenting why.
- [ ] Do not create a second Zustand store.
- [ ] Do not generate fund recommendations as free text.
