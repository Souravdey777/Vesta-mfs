create extension if not exists pgcrypto;

create table if not exists public.funds (
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
  rating integer check (rating between 1 and 5),
  min_sip integer,
  exit_load text,
  updated_at timestamptz not null
);

create index if not exists idx_funds_category on public.funds(category);
create index if not exists idx_funds_aum on public.funds(aum_cr);
create index if not exists idx_funds_plan_type on public.funds(plan_type);
create index if not exists idx_funds_returns_3y on public.funds(returns_3y);

alter table public.funds enable row level security;

drop policy if exists "Anyone can read funds" on public.funds;
create policy "Anyone can read funds"
on public.funds
for select
using (true);

create table if not exists public.saved_filters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  normalized_name text generated always as (lower(btrim(name))) stored,
  filters jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, normalized_name)
);

create index if not exists idx_saved_filters_user_id on public.saved_filters(user_id);

alter table public.saved_filters enable row level security;

drop policy if exists "Users can read their saved filters" on public.saved_filters;
create policy "Users can read their saved filters"
on public.saved_filters
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their saved filters" on public.saved_filters;
create policy "Users can insert their saved filters"
on public.saved_filters
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their saved filters" on public.saved_filters;
create policy "Users can update their saved filters"
on public.saved_filters
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their saved filters" on public.saved_filters;
create policy "Users can delete their saved filters"
on public.saved_filters
for delete
using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_saved_filters_updated_at on public.saved_filters;
create trigger set_saved_filters_updated_at
before update on public.saved_filters
for each row
execute function public.set_updated_at();
