export const FILTER_CATEGORIES = [
  "Large Cap",
  "Mid Cap",
  "Small Cap",
  "Flexi Cap",
  "ELSS",
  "Hybrid",
  "Debt",
  "Index"
] as const;

export const FUND_CATEGORIES = [...FILTER_CATEGORIES, "Other"] as const;
export const PLAN_TYPES = ["Direct", "Regular"] as const;
export const SORT_FIELDS = [
  "returns_1y",
  "returns_3y",
  "returns_5y",
  "aum",
  "expense_ratio",
  "rating"
] as const;
export const SORT_ORDERS = ["asc", "desc"] as const;
export const RATINGS = [1, 2, 3, 4, 5] as const;
export const METRIC_NAMES = [
  "expense_ratio",
  "aum",
  "sharpe_ratio",
  "alpha",
  "beta",
  "exit_load",
  "category_definition"
] as const;

export type FilterCategory = (typeof FILTER_CATEGORIES)[number];
export type FundCategory = (typeof FUND_CATEGORIES)[number];
export type PlanType = (typeof PLAN_TYPES)[number];
export type SortField = (typeof SORT_FIELDS)[number];
export type SortOrder = (typeof SORT_ORDERS)[number];
export type Rating = (typeof RATINGS)[number];
export type MetricName = (typeof METRIC_NAMES)[number];

export type FilterState = {
  category?: FilterCategory;
  min_aum_cr?: number;
  max_expense_ratio?: number;
  min_returns_1y?: number;
  min_returns_3y?: number;
  min_returns_5y?: number;
  min_rating?: Rating;
  fund_house?: string;
  plan_type?: PlanType;
  sort_by?: SortField;
  order?: SortOrder;
};

export type FilterKey = keyof FilterState;

export type FundRow = {
  scheme_code: string;
  scheme_name: string;
  fund_house: string;
  category: FundCategory;
  sub_category: string | null;
  plan_type: PlanType;
  nav: number;
  aum_cr: number | null;
  expense_ratio: number | null;
  returns_1y: number | null;
  returns_3y: number | null;
  returns_5y: number | null;
  rating: Rating | null;
  min_sip: number | null;
  exit_load: string | null;
  updated_at: string;
};


export type SavedFilterRecord = {
  filters: FilterState;
  created_at: string;
  updated_at: string;
};

export type SavedFilters = Record<string, SavedFilterRecord>;

export type SavedFilterRow = {
  id: string;
  user_id: string;
  name: string;
  normalized_name: string;
  filters: FilterState;
  created_at: string;
  updated_at: string;
};

export type ApplyFiltersInput = Partial<FilterState> & {
  replace?: boolean;
};

export type ClearFiltersInput = Record<string, never>;

export type ExplainMetricInput = {
  metric: MetricName;
  context?: string;
};

export type SaveFilterInput = {
  name: string;
};

export type LoadSavedFilterInput = {
  name: string;
};

export type ListSavedFiltersInput = Record<string, never>;

export type ToolName =
  | "apply_filters"
  | "clear_filters"
  | "explain_metric"
  | "save_filter"
  | "load_saved_filter"
  | "list_saved_filters";

export type ToolInputMap = {
  apply_filters: ApplyFiltersInput;
  clear_filters: ClearFiltersInput;
  explain_metric: ExplainMetricInput;
  save_filter: SaveFilterInput;
  load_saved_filter: LoadSavedFilterInput;
  list_saved_filters: ListSavedFiltersInput;
};

export type SavedFiltersStatus = "idle" | "loading" | "ready" | "error";
export type SavedFiltersSource = "localStorage" | "supabase";
