import { describe, expect, it } from "vitest";

import { buildFundsQueryString } from "@/hooks/use-funds";

describe("funds hook helpers", () => {
  it("builds query params from filter state", () => {
    expect(
      buildFundsQueryString({
        category: "Large Cap",
        min_returns_3y: 15,
        min_sharpe_ratio: 1,
        sort_by: "returns_3y",
        order: "desc"
      })
    ).toBe("category=Large+Cap&min_returns_3y=15&min_sharpe_ratio=1&sort_by=returns_3y&order=desc&page=1&pageSize=25");
  });
});
