import {
  FILTER_CATEGORIES,
  PLAN_TYPES,
  RATINGS,
  SORT_FIELDS,
  SORT_ORDERS,
  type ApplyFiltersInput,
  type FilterKey,
  type FilterState,
  type Rating,
  type SortField,
  type SortOrder
} from "@/lib/types";

export const EMPTY_FILTERS: FilterState = {};

const FILTER_CATEGORY_SET = new Set<string>(FILTER_CATEGORIES);
const PLAN_TYPE_SET = new Set<string>(PLAN_TYPES);
const SORT_FIELD_SET = new Set<string>(SORT_FIELDS);
const SORT_ORDER_SET = new Set<string>(SORT_ORDERS);
const RATING_SET = new Set<number>(RATINGS);

const DEFAULT_SORT_ORDER: Record<SortField, SortOrder> = {
  returns_1y: "desc",
  returns_3y: "desc",
  returns_5y: "desc",
  rolling_returns_3y: "desc",
  sharpe_ratio: "desc",
  standard_deviation: "asc",
  beta: "asc",
  upside_capture_ratio: "desc",
  downside_capture_ratio: "asc",
  aum: "desc",
  expense_ratio: "asc",
  rating: "desc"
};

export function getDefaultSortOrder(sortBy: SortField): SortOrder {
  return DEFAULT_SORT_ORDER[sortBy];
}

export function applyFilters(current: FilterState, input: ApplyFiltersInput): FilterState {
  const { replace: _replace, ...changes } = input;
  const base = input.replace ? EMPTY_FILTERS : current;
  const definedChanges = definedEntries(changes);
  const next = {
    ...base,
    ...definedChanges
  };

  if (
    definedChanges.sort_by &&
    definedChanges.order === undefined &&
    definedChanges.sort_by !== base.sort_by
  ) {
    delete next.order;
  }

  return normalizeFilterState(next);
}

export function clearFilters(): FilterState {
  return EMPTY_FILTERS;
}

export function removeFilter(current: FilterState, key: FilterKey): FilterState {
  const next: Partial<FilterState> = { ...current };

  delete next[key];

  if (key === "sort_by") {
    delete next.order;
  }

  return normalizeFilterState(next);
}

export function normalizeFilterState(input: Partial<FilterState>): FilterState {
  const normalized: FilterState = {};

  if (typeof input.category === "string" && FILTER_CATEGORY_SET.has(input.category)) {
    normalized.category = input.category;
  }

  if (isFiniteNumber(input.min_aum_cr)) {
    normalized.min_aum_cr = input.min_aum_cr;
  }

  if (isFiniteNumber(input.max_expense_ratio)) {
    normalized.max_expense_ratio = input.max_expense_ratio;
  }

  if (isFiniteNumber(input.min_returns_1y)) {
    normalized.min_returns_1y = input.min_returns_1y;
  }

  if (isFiniteNumber(input.min_returns_3y)) {
    normalized.min_returns_3y = input.min_returns_3y;
  }

  if (isFiniteNumber(input.min_returns_5y)) {
    normalized.min_returns_5y = input.min_returns_5y;
  }

  if (isFiniteNumber(input.min_rolling_returns_3y)) {
    normalized.min_rolling_returns_3y = input.min_rolling_returns_3y;
  }

  if (isFiniteNumber(input.min_sharpe_ratio)) {
    normalized.min_sharpe_ratio = input.min_sharpe_ratio;
  }

  if (isFiniteNumber(input.max_standard_deviation)) {
    normalized.max_standard_deviation = input.max_standard_deviation;
  }

  if (isFiniteNumber(input.max_beta)) {
    normalized.max_beta = input.max_beta;
  }

  if (isFiniteNumber(input.min_upside_capture_ratio)) {
    normalized.min_upside_capture_ratio = input.min_upside_capture_ratio;
  }

  if (isFiniteNumber(input.max_downside_capture_ratio)) {
    normalized.max_downside_capture_ratio = input.max_downside_capture_ratio;
  }

  if (isRating(input.min_rating)) {
    normalized.min_rating = input.min_rating;
  }

  if (typeof input.fund_house === "string" && input.fund_house.trim()) {
    normalized.fund_house = input.fund_house.trim();
  }

  if (typeof input.plan_type === "string" && PLAN_TYPE_SET.has(input.plan_type)) {
    normalized.plan_type = input.plan_type;
  }

  if (typeof input.sort_by === "string" && SORT_FIELD_SET.has(input.sort_by)) {
    normalized.sort_by = input.sort_by;
    normalized.order =
      typeof input.order === "string" && SORT_ORDER_SET.has(input.order)
        ? input.order
        : getDefaultSortOrder(input.sort_by);
  }

  return normalized;
}

export function normalizeSavedFilterName(name: string): string {
  return name.trim().toLowerCase();
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRating(value: unknown): value is Rating {
  return typeof value === "number" && RATING_SET.has(value);
}

function definedEntries<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
  ) as Partial<T>;
}
