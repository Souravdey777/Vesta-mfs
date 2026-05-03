alter table public.funds
  add column if not exists rolling_returns_3y numeric(6, 2),
  add column if not exists sharpe_ratio numeric(6, 2),
  add column if not exists standard_deviation numeric(6, 2),
  add column if not exists beta numeric(6, 2),
  add column if not exists upside_capture_ratio numeric(6, 2),
  add column if not exists downside_capture_ratio numeric(6, 2);

create index if not exists idx_funds_rolling_returns_3y on public.funds(rolling_returns_3y);
create index if not exists idx_funds_sharpe_ratio on public.funds(sharpe_ratio);
create index if not exists idx_funds_standard_deviation on public.funds(standard_deviation);
