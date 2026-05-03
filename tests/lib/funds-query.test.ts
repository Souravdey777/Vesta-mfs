import { describe, expect, it } from "vitest";

import {
  parseFundsQuery,
  queryFunds,
  type FundsQueryBuilder,
  type FundsQueryParams,
  type FundsSupabaseClient,
  type FundsValidationIssue
} from "@/lib/server/funds-query";
import type { FundRow } from "@/lib/types";

const SAMPLE_FUND: FundRow = {
  scheme_code: "100001",
  scheme_name: "HDFC Large Cap Direct Growth",
  fund_house: "HDFC",
  category: "Large Cap",
  sub_category: null,
  plan_type: "Direct",
  nav: 123.45,
  aum_cr: 15000,
  expense_ratio: 0.72,
  returns_1y: 18.2,
  returns_3y: 16.4,
  returns_5y: 14.1,
  rolling_returns_3y: 15.9,
  sharpe_ratio: 1.05,
  standard_deviation: 12.7,
  beta: 0.92,
  upside_capture_ratio: 96.3,
  downside_capture_ratio: 84.8,
  rating: 5,
  min_sip: 500,
  exit_load: "1% if redeemed within 1 year",
  updated_at: "2026-05-01T00:00:00.000Z"
};

describe("funds query parsing", () => {
  it("validates a full filter set and defaults return sort order", () => {
    const params = expectValidFundsQuery({
      category: "Large Cap",
      min_aum_cr: "10000",
      max_expense_ratio: "1",
      min_returns_1y: "10",
      min_returns_3y: "15",
      min_returns_5y: "12",
      min_rolling_returns_3y: "14",
      min_sharpe_ratio: "1",
      max_standard_deviation: "15",
      max_beta: "1",
      min_upside_capture_ratio: "90",
      max_downside_capture_ratio: "85",
      min_rating: "4",
      fund_house: " HDFC ",
      plan_type: "Direct",
      sort_by: "returns_3y",
      page: "2",
      pageSize: "10"
    });

    expect(params).toEqual({
      filters: {
        category: "Large Cap",
        min_aum_cr: 10000,
        max_expense_ratio: 1,
        min_returns_1y: 10,
        min_returns_3y: 15,
        min_returns_5y: 12,
        min_rolling_returns_3y: 14,
        min_sharpe_ratio: 1,
        max_standard_deviation: 15,
        max_beta: 1,
        min_upside_capture_ratio: 90,
        max_downside_capture_ratio: 85,
        min_rating: 4,
        fund_house: "HDFC",
        plan_type: "Direct",
        sort_by: "returns_3y",
        order: "desc"
      },
      page: 2,
      pageSize: 10,
      sort: {
        column: "returns_3y",
        order: "desc"
      }
    });
  });

  it("rejects invalid category, plan, rating, and order values", () => {
    const issues = expectInvalidFundsQuery({
      category: "Liquid",
      plan_type: "Growth",
      min_rating: "6",
      max_beta: "-1",
      order: "sideways"
    });

    expect(issues.map((issue) => issue.path)).toEqual(
      expect.arrayContaining(["category", "plan_type", "min_rating", "max_beta", "order"])
    );
  });

  it("defaults and bounds pagination", () => {
    const defaults = expectValidFundsQuery({});
    expect(defaults.page).toBe(1);
    expect(defaults.pageSize).toBe(25);

    const issues = expectInvalidFundsQuery({
      page: "0",
      pageSize: "101"
    });

    expect(issues.map((issue) => issue.path)).toEqual(expect.arrayContaining(["page", "pageSize"]));
  });

  it("defaults expense-ratio sort ascending and broad queries to AUM descending", () => {
    const expenseRatioSort = expectValidFundsQuery({
      sort_by: "expense_ratio"
    });
    expect(expenseRatioSort.filters.order).toBe("asc");
    expect(expenseRatioSort.sort).toEqual({
      column: "expense_ratio",
      order: "asc"
    });

    const defaultSort = expectValidFundsQuery({});
    expect(defaultSort.sort).toEqual({
      column: "aum_cr",
      order: "desc"
    });
  });

  it("defaults advanced metric sort directions", () => {
    expect(expectValidFundsQuery({ sort_by: "rolling_returns_3y" }).sort).toEqual({
      column: "rolling_returns_3y",
      order: "desc"
    });
    expect(expectValidFundsQuery({ sort_by: "sharpe_ratio" }).sort).toEqual({
      column: "sharpe_ratio",
      order: "desc"
    });
    expect(expectValidFundsQuery({ sort_by: "standard_deviation" }).sort).toEqual({
      column: "standard_deviation",
      order: "asc"
    });
  });
});

describe("funds Supabase query", () => {
  it("applies filters, deterministic sorting, exact count, and page range", async () => {
    const mock = createMockFundsClient({
      data: [SAMPLE_FUND],
      count: 1,
      error: null
    });
    const params = expectValidFundsQuery({
      category: "Large Cap",
      min_aum_cr: "10000",
      max_expense_ratio: "1",
      min_returns_1y: "10",
      min_returns_3y: "15",
      min_returns_5y: "12",
      min_rolling_returns_3y: "14",
      min_sharpe_ratio: "1",
      max_standard_deviation: "15",
      max_beta: "1",
      min_upside_capture_ratio: "90",
      max_downside_capture_ratio: "85",
      min_rating: "4",
      fund_house: "HDFC",
      plan_type: "Direct",
      sort_by: "aum",
      page: "2",
      pageSize: "10"
    });

    const result = await queryFunds(mock.client, params);

    expect(result).toMatchObject({
      funds: [SAMPLE_FUND],
      total: 1,
      page: 2,
      pageSize: 10,
      pageCount: 1,
      zeroState: null
    });
    expect(mock.calls).toEqual([
      "from:funds",
      "select:exact",
      "eq:category:Large Cap",
      "eq:plan_type:Direct",
      "gte:aum_cr:10000",
      "lte:expense_ratio:1",
      "gte:returns_1y:10",
      "gte:returns_3y:15",
      "gte:returns_5y:12",
      "gte:rolling_returns_3y:14",
      "gte:sharpe_ratio:1",
      "lte:standard_deviation:15",
      "lte:beta:1",
      "gte:upside_capture_ratio:90",
      "lte:downside_capture_ratio:85",
      "gte:rating:4",
      "ilike:fund_house:%HDFC%",
      "order:aum_cr:desc:nulls_last",
      "order:scheme_name:asc:nulls_last",
      "order:scheme_code:asc:nulls_last",
      "range:10:19"
    ]);
  });

  it("returns zero-state metadata when no funds match", async () => {
    const mock = createMockFundsClient({
      data: [],
      count: 0,
      error: null
    });
    const params = expectValidFundsQuery({
      category: "Small Cap",
      min_returns_3y: "50",
      max_expense_ratio: "0.1"
    });

    const result = await queryFunds(mock.client, params);

    expect(result.zeroState).toEqual({
      reason: "no_matches",
      message: "No funds matched. Try relaxing the strictest filters.",
      suggestions: [
        {
          label: "Remove the 3-year return floor",
          removeFilter: "min_returns_3y"
        },
        {
          label: "Relax the expense ratio cap",
          removeFilter: "max_expense_ratio"
        }
      ]
    });
  });

  it("suggests relaxing advanced metric filters when they produce no matches", async () => {
    const mock = createMockFundsClient({
      data: [],
      count: 0,
      error: null
    });
    const params = expectValidFundsQuery({
      min_sharpe_ratio: "2",
      max_standard_deviation: "5"
    });

    const result = await queryFunds(mock.client, params);

    expect(result.zeroState?.suggestions).toEqual([
      {
        label: "Lower the Sharpe ratio floor",
        removeFilter: "min_sharpe_ratio"
      },
      {
        label: "Relax the volatility cap",
        removeFilter: "max_standard_deviation"
      }
    ]);
  });

  it("throws a sanitized query error instead of exposing Supabase internals", async () => {
    const mock = createMockFundsClient({
      data: null,
      count: null,
      error: {
        message: "permission denied for table funds"
      }
    });

    await expect(queryFunds(mock.client, expectValidFundsQuery({}))).rejects.toThrow(
      "Supabase funds query failed."
    );
  });
});

function expectValidFundsQuery(params: Record<string, string>): FundsQueryParams {
  const parsed = parseFundsQuery(new URLSearchParams(params));

  if (!parsed.ok) {
    throw new Error(`Expected valid funds query, got ${JSON.stringify(parsed.issues)}`);
  }

  return parsed.params;
}

function expectInvalidFundsQuery(params: Record<string, string>): FundsValidationIssue[] {
  const parsed = parseFundsQuery(new URLSearchParams(params));

  if (parsed.ok) {
    throw new Error(`Expected invalid funds query, got ${JSON.stringify(parsed.params)}`);
  }

  return parsed.issues;
}

function createMockFundsClient(result: {
  data: FundRow[] | null;
  count: number | null;
  error: { message: string } | null;
}) {
  const calls: string[] = [];

  class MockFundsQueryBuilder implements FundsQueryBuilder {
    eq(column: string, value: string | number) {
      calls.push(`eq:${column}:${value}`);
      return this;
    }

    gte(column: string, value: number) {
      calls.push(`gte:${column}:${value}`);
      return this;
    }

    lte(column: string, value: number) {
      calls.push(`lte:${column}:${value}`);
      return this;
    }

    ilike(column: string, pattern: string) {
      calls.push(`ilike:${column}:${pattern}`);
      return this;
    }

    order(column: string, options: { ascending: boolean; nullsFirst?: boolean }) {
      calls.push(
        `order:${column}:${options.ascending ? "asc" : "desc"}:${
          options.nullsFirst === false ? "nulls_last" : "default_nulls"
        }`
      );
      return this;
    }

    async range(from: number, to: number) {
      calls.push(`range:${from}:${to}`);
      return result;
    }
  }

  const client: FundsSupabaseClient = {
    from: (table) => {
      calls.push(`from:${table}`);

      return {
        select: (_columns, options) => {
          calls.push(`select:${options.count}`);
          return new MockFundsQueryBuilder();
        }
      };
    }
  };

  return {
    client,
    calls
  };
}
