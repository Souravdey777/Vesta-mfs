import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { getDefaultSortOrder } from "@/lib/filters";
import {
  FILTER_CATEGORIES,
  MAX_RESULT_LIMIT,
  MIN_RESULT_LIMIT,
  PLAN_TYPES,
  SORT_FIELDS,
  SORT_ORDERS,
  type CategoryBenchmark,
  type FilterKey,
  type FilterState,
  type FundCategory,
  type FundRow,
  type FundsQueryData,
  type FundsZeroState,
  type PlanType,
  type Rating,
  type SortField,
  type SortOrder
} from "@/lib/types";

const FUNDS_SELECT_COLUMNS =
  "scheme_code,scheme_name,fund_house,category,sub_category,plan_type,nav,aum_cr,expense_ratio,returns_1y,returns_3y,returns_5y,rolling_returns_3y,sharpe_ratio,standard_deviation,beta,upside_capture_ratio,downside_capture_ratio,rating,min_sip,exit_load,updated_at";
const CATEGORY_BENCHMARK_SELECT_COLUMNS =
  "category,plan_type,expense_ratio,returns_1y,returns_3y,returns_5y,rolling_returns_3y,sharpe_ratio,standard_deviation";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const BENCHMARK_PAGE_SIZE = 500;

const CATEGORY_BENCHMARK_METRICS = [
  "returns_1y",
  "returns_3y",
  "returns_5y",
  "rolling_returns_3y",
  "sharpe_ratio",
  "standard_deviation",
  "expense_ratio"
] as const;

const SORT_COLUMN_BY_FIELD: Record<SortField, FundsSortColumn> = {
  returns_1y: "returns_1y",
  returns_3y: "returns_3y",
  returns_5y: "returns_5y",
  rolling_returns_3y: "rolling_returns_3y",
  sharpe_ratio: "sharpe_ratio",
  standard_deviation: "standard_deviation",
  beta: "beta",
  upside_capture_ratio: "upside_capture_ratio",
  downside_capture_ratio: "downside_capture_ratio",
  aum: "aum_cr",
  expense_ratio: "expense_ratio",
  rating: "rating"
};

const FILTER_RELAXATION_ORDER: Array<{
  key: FilterKey;
  label: string;
}> = [
  { key: "min_returns_5y", label: "Remove the 5-year return floor" },
  { key: "min_returns_3y", label: "Remove the 3-year return floor" },
  { key: "min_returns_1y", label: "Remove the 1-year return floor" },
  { key: "min_rolling_returns_3y", label: "Remove the rolling 3-year return floor" },
  { key: "min_sharpe_ratio", label: "Lower the Sharpe ratio floor" },
  { key: "max_standard_deviation", label: "Relax the volatility cap" },
  { key: "max_beta", label: "Relax the beta cap" },
  { key: "min_upside_capture_ratio", label: "Lower the upside capture floor" },
  { key: "max_downside_capture_ratio", label: "Relax the downside capture cap" },
  { key: "max_expense_ratio", label: "Relax the expense ratio cap" },
  { key: "min_rating", label: "Lower the rating floor" },
  { key: "min_aum_cr", label: "Lower the AUM floor" },
  { key: "category", label: "Broaden the fund category" },
  { key: "plan_type", label: "Include both plan types" },
  { key: "fund_house", label: "Remove the fund-house filter" }
];

const fundsQuerySchema = z.object({
  category: z.preprocess(emptyStringToUndefined, z.enum(FILTER_CATEGORIES).optional()),
  min_aum_cr: optionalNonNegativeNumberSchema(),
  max_expense_ratio: optionalNonNegativeNumberSchema(),
  min_returns_1y: optionalFiniteNumberSchema(),
  min_returns_3y: optionalFiniteNumberSchema(),
  min_returns_5y: optionalFiniteNumberSchema(),
  min_rolling_returns_3y: optionalFiniteNumberSchema(),
  min_sharpe_ratio: optionalFiniteNumberSchema(),
  max_standard_deviation: optionalNonNegativeNumberSchema(),
  max_beta: optionalNonNegativeNumberSchema(),
  min_upside_capture_ratio: optionalFiniteNumberSchema(),
  max_downside_capture_ratio: optionalNonNegativeNumberSchema(),
  min_rating: z.preprocess(
    emptyStringToUndefined,
    z.coerce.number().int().min(1).max(5).optional()
  ),
  fund_house: z.preprocess(emptyStringToUndefined, z.string().trim().min(1).optional()),
  limit: z.preprocess(
    emptyStringToUndefined,
    z.coerce.number().int().min(MIN_RESULT_LIMIT).max(MAX_RESULT_LIMIT).optional()
  ),
  plan_type: z.preprocess(emptyStringToUndefined, z.enum(PLAN_TYPES).optional()),
  sort_by: z.preprocess(emptyStringToUndefined, z.enum(SORT_FIELDS).optional()),
  order: z.preprocess(emptyStringToUndefined, z.enum(SORT_ORDERS).optional()),
  page: z.preprocess(
    emptyStringToUndefined,
    z.coerce.number().int().min(1).default(DEFAULT_PAGE)
  ),
  pageSize: z.preprocess(
    emptyStringToUndefined,
    z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE)
  )
});

export type FundsSortColumn =
  | "returns_1y"
  | "returns_3y"
  | "returns_5y"
  | "rolling_returns_3y"
  | "sharpe_ratio"
  | "standard_deviation"
  | "beta"
  | "upside_capture_ratio"
  | "downside_capture_ratio"
  | "aum_cr"
  | "expense_ratio"
  | "rating";

export type FundsSort = {
  column: FundsSortColumn;
  order: SortOrder;
};

export type FundsQueryParams = {
  filters: FilterState;
  page: number;
  pageSize: number;
  sort: FundsSort;
};

export type CategoryBenchmarkMetric = (typeof CATEGORY_BENCHMARK_METRICS)[number];

export type CategoryBenchmarkPeerRow = Pick<
  FundRow,
  "category" | "plan_type" | CategoryBenchmarkMetric
>;

export type FundsValidationIssue = {
  path: string;
  message: string;
};

export type FundsQueryParseResult =
  | {
      ok: true;
      params: FundsQueryParams;
    }
  | {
      ok: false;
      issues: FundsValidationIssue[];
    };

export type FundsQueryBuilder<Row = FundRow> = {
  eq: (column: string, value: string | number) => FundsQueryBuilder<Row>;
  gte: (column: string, value: number) => FundsQueryBuilder<Row>;
  lte: (column: string, value: number) => FundsQueryBuilder<Row>;
  ilike: (column: string, pattern: string) => FundsQueryBuilder<Row>;
  order: (
    column: string,
    options: {
      ascending: boolean;
      nullsFirst?: boolean;
    }
  ) => FundsQueryBuilder<Row>;
  range: (
    from: number,
    to: number
  ) => Promise<{
    data: Row[] | null;
    count: number | null;
    error: { message: string } | null;
  }>;
};

export type FundsSupabaseClient = {
  from: (table: "funds") => {
    select: <Row = FundRow>(
      columns: string,
      options: {
        count: "exact";
      }
    ) => FundsQueryBuilder<Row>;
  };
};

export class FundsQueryError extends Error {
  readonly kind: "configuration" | "query";
  readonly details?: unknown;

  constructor(kind: "configuration" | "query", message: string, details?: unknown) {
    super(message);
    this.name = "FundsQueryError";
    this.kind = kind;
    this.details = details;
  }
}

export function createFundsSupabaseClient(): FundsSupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new FundsQueryError("configuration", "Supabase read env vars are missing.");
  }

  return createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false
    }
  }) as unknown as FundsSupabaseClient;
}

export function parseFundsQuery(searchParams: URLSearchParams): FundsQueryParseResult {
  const parsed = fundsQuerySchema.safeParse(readFundsQueryParams(searchParams));

  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join(".") || "query",
        message: issue.message
      }))
    };
  }

  const data = parsed.data;
  const filters = buildFilterState(data);
  const sort = resolveFundsSort(filters);

  return {
    ok: true,
    params: {
      filters,
      page: data.page,
      pageSize: data.pageSize,
      sort
    }
  };
}

export async function queryFunds(
  supabase: FundsSupabaseClient,
  params: FundsQueryParams
): Promise<FundsQueryData> {
  const { filters, page, pageSize, sort } = params;
  let query = supabase.from("funds").select(FUNDS_SELECT_COLUMNS, {
    count: "exact"
  });

  query = applyFundsFilters(query, filters);
  query = query
    .order(sort.column, {
      ascending: sort.order === "asc",
      nullsFirst: false
    })
    .order("scheme_name", {
      ascending: true,
      nullsFirst: false
    })
    .order("scheme_code", {
      ascending: true,
      nullsFirst: false
    });

  const range = getFundsPageRange({
    limit: filters.limit,
    page,
    pageSize
  });
  const { data, count, error } = await query.range(range.from, range.to);

  if (error) {
    throw new FundsQueryError("query", "Supabase funds query failed.", error);
  }

  const funds = data ?? [];
  const totalMatches = count ?? funds.length;
  const total = getEffectiveTotal(totalMatches, filters.limit);
  const categoryBenchmarks = await queryCategoryBenchmarksForFunds(supabase, funds);

  return {
    funds,
    categoryBenchmarks,
    total,
    page: range.page,
    pageSize,
    pageCount: total === 0 ? 0 : Math.ceil(total / pageSize),
    filters,
    zeroState: totalMatches === 0 ? buildZeroState(filters) : null
  };
}

function getFundsPageRange({
  limit,
  page,
  pageSize
}: {
  limit: number | undefined;
  page: number;
  pageSize: number;
}): {
  from: number;
  page: number;
  to: number;
} {
  const requestedFrom = (page - 1) * pageSize;

  if (limit === undefined) {
    return {
      from: requestedFrom,
      page,
      to: requestedFrom + pageSize - 1
    };
  }

  const lastPage = Math.max(1, Math.ceil(limit / pageSize));
  const effectivePage = Math.min(page, lastPage);
  const from = (effectivePage - 1) * pageSize;
  const to = Math.min(from + pageSize - 1, limit - 1);

  return {
    from,
    page: effectivePage,
    to
  };
}

function getEffectiveTotal(totalMatches: number, limit: number | undefined): number {
  return limit === undefined ? totalMatches : Math.min(totalMatches, limit);
}

async function queryCategoryBenchmarksForFunds(
  supabase: FundsSupabaseClient,
  funds: FundRow[]
): Promise<CategoryBenchmark[]> {
  if (funds.length === 0) {
    return [];
  }

  const groups = getBenchmarkGroups(funds);
  const peerRowsByGroup = await Promise.all(
    groups.map((group) => fetchBenchmarkPeerRows(supabase, group))
  );

  return buildCategoryBenchmarks(peerRowsByGroup.flat());
}

async function fetchBenchmarkPeerRows(
  supabase: FundsSupabaseClient,
  group: Pick<CategoryBenchmark, "category" | "plan_type">
): Promise<CategoryBenchmarkPeerRow[]> {
  const peerRows: CategoryBenchmarkPeerRow[] = [];
  let from = 0;
  let total: number | null = null;

  while (total === null || peerRows.length < total) {
    let query = supabase
      .from("funds")
      .select<CategoryBenchmarkPeerRow>(CATEGORY_BENCHMARK_SELECT_COLUMNS, {
        count: "exact"
      });

    query = query.eq("category", group.category).eq("plan_type", group.plan_type);

    const to = from + BENCHMARK_PAGE_SIZE - 1;
    const { data, count, error } = await query.range(from, to);

    if (error) {
      throw new FundsQueryError("query", "Supabase benchmark query failed.", error);
    }

    const rows = data ?? [];
    peerRows.push(...rows);
    total = count ?? peerRows.length;

    if (rows.length === 0 || rows.length < BENCHMARK_PAGE_SIZE) {
      break;
    }

    from += BENCHMARK_PAGE_SIZE;
  }

  return peerRows;
}

export function buildCategoryBenchmarks(
  rows: CategoryBenchmarkPeerRow[]
): CategoryBenchmark[] {
  const groups = new Map<string, CategoryBenchmarkPeerRow[]>();

  for (const row of rows) {
    const key = getBenchmarkKey(row.category, row.plan_type);
    const group = groups.get(key);

    if (group) {
      group.push(row);
    } else {
      groups.set(key, [row]);
    }
  }

  return Array.from(groups.values())
    .map((group) => {
      const first = group[0];

      return {
        category: first.category,
        plan_type: first.plan_type,
        fundCount: group.length,
        returns_1y: calculateMedian(group.map((row) => row.returns_1y)),
        returns_3y: calculateMedian(group.map((row) => row.returns_3y)),
        returns_5y: calculateMedian(group.map((row) => row.returns_5y)),
        rolling_returns_3y: calculateMedian(group.map((row) => row.rolling_returns_3y)),
        sharpe_ratio: calculateMedian(group.map((row) => row.sharpe_ratio)),
        standard_deviation: calculateMedian(group.map((row) => row.standard_deviation)),
        expense_ratio: calculateMedian(group.map((row) => row.expense_ratio))
      };
    })
    .sort((first, second) => {
      const categoryOrder = first.category.localeCompare(second.category);

      return categoryOrder === 0
        ? first.plan_type.localeCompare(second.plan_type)
        : categoryOrder;
    });
}

export function calculateMedian(values: Array<number | null | undefined>): number | null {
  const sortedValues = values
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .sort((first, second) => first - second);

  if (sortedValues.length === 0) {
    return null;
  }

  const midpoint = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 1) {
    return sortedValues[midpoint];
  }

  return (sortedValues[midpoint - 1] + sortedValues[midpoint]) / 2;
}

function getBenchmarkGroups(
  funds: FundRow[]
): Array<Pick<CategoryBenchmark, "category" | "plan_type">> {
  const groups = new Map<string, Pick<CategoryBenchmark, "category" | "plan_type">>();

  for (const fund of funds) {
    groups.set(getBenchmarkKey(fund.category, fund.plan_type), {
      category: fund.category,
      plan_type: fund.plan_type
    });
  }

  return Array.from(groups.values());
}

function getBenchmarkKey(category: FundCategory, planType: PlanType): string {
  return `${category}:${planType}`;
}

function applyFundsFilters(query: FundsQueryBuilder, filters: FilterState): FundsQueryBuilder {
  let next = query;

  if (filters.category) {
    next = next.eq("category", filters.category);
  }

  if (filters.plan_type) {
    next = next.eq("plan_type", filters.plan_type);
  }

  if (filters.min_aum_cr !== undefined) {
    next = next.gte("aum_cr", filters.min_aum_cr);
  }

  if (filters.max_expense_ratio !== undefined) {
    next = next.lte("expense_ratio", filters.max_expense_ratio);
  }

  if (filters.min_returns_1y !== undefined) {
    next = next.gte("returns_1y", filters.min_returns_1y);
  }

  if (filters.min_returns_3y !== undefined) {
    next = next.gte("returns_3y", filters.min_returns_3y);
  }

  if (filters.min_returns_5y !== undefined) {
    next = next.gte("returns_5y", filters.min_returns_5y);
  }

  if (filters.min_rolling_returns_3y !== undefined) {
    next = next.gte("rolling_returns_3y", filters.min_rolling_returns_3y);
  }

  if (filters.min_sharpe_ratio !== undefined) {
    next = next.gte("sharpe_ratio", filters.min_sharpe_ratio);
  }

  if (filters.max_standard_deviation !== undefined) {
    next = next.lte("standard_deviation", filters.max_standard_deviation);
  }

  if (filters.max_beta !== undefined) {
    next = next.lte("beta", filters.max_beta);
  }

  if (filters.min_upside_capture_ratio !== undefined) {
    next = next.gte("upside_capture_ratio", filters.min_upside_capture_ratio);
  }

  if (filters.max_downside_capture_ratio !== undefined) {
    next = next.lte("downside_capture_ratio", filters.max_downside_capture_ratio);
  }

  if (filters.min_rating !== undefined) {
    next = next.gte("rating", filters.min_rating);
  }

  if (filters.fund_house) {
    next = next.ilike("fund_house", `%${filters.fund_house}%`);
  }

  return next;
}

function resolveFundsSort(filters: FilterState): FundsSort {
  if (!filters.sort_by) {
    return {
      column: "aum_cr",
      order: "desc"
    };
  }

  return {
    column: SORT_COLUMN_BY_FIELD[filters.sort_by],
    order: filters.order ?? getDefaultSortOrder(filters.sort_by)
  };
}

function buildZeroState(filters: FilterState): FundsZeroState {
  const suggestions = FILTER_RELAXATION_ORDER.filter(({ key }) => filters[key] !== undefined)
    .slice(0, 2)
    .map(({ key, label }) => ({
      label,
      removeFilter: key
    }));

  return {
    reason: "no_matches",
    message:
      suggestions.length > 0
        ? "No funds matched. Try relaxing the strictest filters."
        : "No funds matched. Try a broader screen.",
    suggestions
  };
}

function buildFilterState(data: z.infer<typeof fundsQuerySchema>): FilterState {
  const filters: FilterState = {};

  if (data.category) {
    filters.category = data.category;
  }

  if (data.min_aum_cr !== undefined) {
    filters.min_aum_cr = data.min_aum_cr;
  }

  if (data.max_expense_ratio !== undefined) {
    filters.max_expense_ratio = data.max_expense_ratio;
  }

  if (data.min_returns_1y !== undefined) {
    filters.min_returns_1y = data.min_returns_1y;
  }

  if (data.min_returns_3y !== undefined) {
    filters.min_returns_3y = data.min_returns_3y;
  }

  if (data.min_returns_5y !== undefined) {
    filters.min_returns_5y = data.min_returns_5y;
  }

  if (data.min_rolling_returns_3y !== undefined) {
    filters.min_rolling_returns_3y = data.min_rolling_returns_3y;
  }

  if (data.min_sharpe_ratio !== undefined) {
    filters.min_sharpe_ratio = data.min_sharpe_ratio;
  }

  if (data.max_standard_deviation !== undefined) {
    filters.max_standard_deviation = data.max_standard_deviation;
  }

  if (data.max_beta !== undefined) {
    filters.max_beta = data.max_beta;
  }

  if (data.min_upside_capture_ratio !== undefined) {
    filters.min_upside_capture_ratio = data.min_upside_capture_ratio;
  }

  if (data.max_downside_capture_ratio !== undefined) {
    filters.max_downside_capture_ratio = data.max_downside_capture_ratio;
  }

  if (data.min_rating !== undefined) {
    filters.min_rating = data.min_rating as Rating;
  }

  if (data.fund_house) {
    filters.fund_house = data.fund_house;
  }

  if (data.limit !== undefined) {
    filters.limit = data.limit;
  }

  if (data.plan_type) {
    filters.plan_type = data.plan_type;
  }

  if (data.sort_by) {
    filters.sort_by = data.sort_by;
    filters.order = data.order ?? getDefaultSortOrder(data.sort_by);
  }

  return filters;
}

function readFundsQueryParams(searchParams: URLSearchParams) {
  return {
    category: searchParams.get("category") ?? undefined,
    min_aum_cr: searchParams.get("min_aum_cr") ?? undefined,
    max_expense_ratio: searchParams.get("max_expense_ratio") ?? undefined,
    min_returns_1y: searchParams.get("min_returns_1y") ?? undefined,
    min_returns_3y: searchParams.get("min_returns_3y") ?? undefined,
    min_returns_5y: searchParams.get("min_returns_5y") ?? undefined,
    min_rolling_returns_3y: searchParams.get("min_rolling_returns_3y") ?? undefined,
    min_sharpe_ratio: searchParams.get("min_sharpe_ratio") ?? undefined,
    max_standard_deviation: searchParams.get("max_standard_deviation") ?? undefined,
    max_beta: searchParams.get("max_beta") ?? undefined,
    min_upside_capture_ratio: searchParams.get("min_upside_capture_ratio") ?? undefined,
    max_downside_capture_ratio: searchParams.get("max_downside_capture_ratio") ?? undefined,
    min_rating: searchParams.get("min_rating") ?? undefined,
    fund_house: searchParams.get("fund_house") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    plan_type: searchParams.get("plan_type") ?? undefined,
    sort_by: searchParams.get("sort_by") ?? undefined,
    order: searchParams.get("order") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined
  };
}

function optionalFiniteNumberSchema() {
  return z.preprocess(emptyStringToUndefined, z.coerce.number().finite().optional());
}

function optionalNonNegativeNumberSchema() {
  return z.preprocess(emptyStringToUndefined, z.coerce.number().finite().min(0).optional());
}

function emptyStringToUndefined(value: unknown) {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}
