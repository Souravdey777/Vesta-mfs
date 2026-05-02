import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/funds/route";
import { getFundsResponse } from "@/lib/server/funds-route";
import type { FundsQueryBuilder, FundsSupabaseClient } from "@/lib/server/funds-query";
import type { FundRow, FundsQueryData } from "@/lib/types";

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
  rating: 5,
  min_sip: 500,
  exit_load: "1% if redeemed within 1 year",
  updated_at: "2026-05-01T00:00:00.000Z"
};

describe("funds route", () => {
  it("returns 400 for invalid query params", async () => {
    const response = await GET(new Request("http://localhost/api/funds?category=Liquid"));
    const body = (await response.json()) as {
      ok: false;
      error: string;
      issues: Array<{ path: string; message: string }>;
    };

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("Invalid funds query.");
    expect(body.issues[0]?.path).toBe("category");
  });

  it("returns paged funds from Supabase", async () => {
    const response = await getFundsResponse(
      new Request("http://localhost/api/funds?category=Large+Cap&min_returns_3y=15&pageSize=10"),
      {
        supabase: createMockFundsClient({
          data: [SAMPLE_FUND],
          count: 1,
          error: null
        }),
        logger: silentLogger
      }
    );
    const body = (await response.json()) as {
      ok: true;
      data: FundsQueryData;
    };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      data: {
        funds: [SAMPLE_FUND],
        total: 1,
        page: 1,
        pageSize: 10,
        pageCount: 1,
        filters: {
          category: "Large Cap",
          min_returns_3y: 15
        },
        zeroState: null
      }
    });
  });

  it("returns zero-state metadata for empty result sets", async () => {
    const response = await getFundsResponse(
      new Request("http://localhost/api/funds?min_returns_3y=50&max_expense_ratio=0.1"),
      {
        supabase: createMockFundsClient({
          data: [],
          count: 0,
          error: null
        }),
        logger: silentLogger
      }
    );
    const body = (await response.json()) as {
      ok: true;
      data: FundsQueryData;
    };

    expect(response.status).toBe(200);
    expect(body.data.zeroState).toMatchObject({
      reason: "no_matches",
      suggestions: [
        {
          removeFilter: "min_returns_3y"
        },
        {
          removeFilter: "max_expense_ratio"
        }
      ]
    });
  });

  it("returns sanitized 500 errors for Supabase failures", async () => {
    const response = await getFundsResponse(new Request("http://localhost/api/funds"), {
      supabase: createMockFundsClient({
        data: null,
        count: null,
        error: {
          message: "permission denied for table funds"
        }
      }),
      logger: silentLogger
    });
    const body = (await response.json()) as {
      ok: false;
      error: string;
    };

    expect(response.status).toBe(500);
    expect(body).toEqual({
      ok: false,
      error: "Unable to load funds right now."
    });
    expect(JSON.stringify(body)).not.toContain("permission denied");
  });
});

const silentLogger = {
  error: () => undefined
};

function createMockFundsClient(result: {
  data: FundRow[] | null;
  count: number | null;
  error: { message: string } | null;
}): FundsSupabaseClient {
  class MockFundsQueryBuilder implements FundsQueryBuilder {
    eq() {
      return this;
    }

    gte() {
      return this;
    }

    lte() {
      return this;
    }

    ilike() {
      return this;
    }

    order() {
      return this;
    }

    async range() {
      return result;
    }
  }

  return {
    from: () => ({
      select: () => new MockFundsQueryBuilder()
    })
  };
}
