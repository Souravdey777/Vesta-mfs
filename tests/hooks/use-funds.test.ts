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

  it("keeps top-N limit separate from page size", () => {
    expect(
      buildFundsQueryString({
        category: "Large Cap",
        limit: 5,
        sort_by: "returns_3y",
        order: "desc"
      })
    ).toBe("category=Large+Cap&limit=5&sort_by=returns_3y&order=desc&page=1&pageSize=25");
  });

  it("includes the requested page in query params", () => {
    expect(
      buildFundsQueryString(
        {
          category: "Large Cap",
          limit: 5,
          sort_by: "returns_3y",
          order: "desc"
        },
        {
          page: 2
        }
      )
    ).toBe("category=Large+Cap&limit=5&sort_by=returns_3y&order=desc&page=2&pageSize=25");
  });
});
