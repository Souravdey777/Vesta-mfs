import { describe, expect, it } from "vitest";

import {
  buildChatUiContext,
  buildUiContextSystemPrompt,
  getAllowedFundNamesFromUiContext
} from "@/lib/chat-ui-context";
import type { CategoryBenchmark, FundRow, FundsQueryData } from "@/lib/types";

describe("chat UI context", () => {
  it("summarizes the visible result page for chat", () => {
    const context = buildChatUiContext({
      filters: {
        category: "Large Cap",
        min_returns_3y: 15
      },
      fundsData: createFundsData([sampleFund], [sampleCategoryBenchmark]),
      fundsError: null,
      fundsStatus: "success"
    });

    expect(context.results.visibleRange).toEqual({
      end: 1,
      start: 1
    });
    expect(context.results.visibleFunds[0]).toMatchObject({
      scheme_name: "HDFC Large Cap Direct Growth",
      returns_3y_vs_category: 1.4
    });
    expect(getAllowedFundNamesFromUiContext(context)).toEqual([
      "HDFC Large Cap Direct Growth"
    ]);

    const prompt = buildUiContextSystemPrompt(context);

    expect(prompt).toContain("CURRENT UI CONTEXT");
    expect(prompt).toContain("Active filters");
    expect(prompt).toContain("HDFC Large Cap Direct Growth");
    expect(prompt).toContain("Visible range: 1-1 of 1");
  });
});

const sampleFund: FundRow = {
  aum_cr: 15000,
  beta: 0.92,
  category: "Large Cap",
  downside_capture_ratio: 84.8,
  exit_load: "1% if redeemed within 1 year",
  expense_ratio: 0.72,
  fund_house: "HDFC",
  min_sip: 500,
  nav: 123.45,
  plan_type: "Direct",
  rating: 5,
  returns_1y: 18.2,
  returns_3y: 16.4,
  returns_5y: 14.1,
  rolling_returns_3y: 15.9,
  scheme_code: "100001",
  scheme_name: "HDFC Large Cap Direct Growth",
  sharpe_ratio: 1.05,
  standard_deviation: 12.7,
  sub_category: "Large Cap Fund",
  updated_at: "2026-05-01T00:00:00.000Z",
  upside_capture_ratio: 96.3
};

const sampleCategoryBenchmark: CategoryBenchmark = {
  category: "Large Cap",
  expense_ratio: 0.82,
  fundCount: 3,
  plan_type: "Direct",
  returns_1y: 17,
  returns_3y: 15,
  returns_5y: 13.4,
  rolling_returns_3y: 14.8,
  sharpe_ratio: 0.95,
  standard_deviation: 13.1
};

function createFundsData(
  funds: FundRow[],
  categoryBenchmarks: CategoryBenchmark[]
): FundsQueryData {
  return {
    categoryBenchmarks,
    filters: {
      category: "Large Cap",
      min_returns_3y: 15
    },
    funds,
    page: 1,
    pageCount: 1,
    pageSize: 25,
    total: funds.length,
    zeroState: null
  };
}
