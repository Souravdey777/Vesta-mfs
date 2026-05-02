import { describe, expect, it } from "vitest";

import {
  applyFilters,
  clearFilters,
  normalizeFilterState,
  normalizeSavedFilterName,
  removeFilter
} from "@/lib/filters";
import type { FilterState } from "@/lib/types";

describe("filter helpers", () => {
  it("applies additive filter updates", () => {
    const current: FilterState = {
      category: "Large Cap",
      min_returns_3y: 15
    };

    expect(
      applyFilters(current, {
        max_expense_ratio: 1,
        fund_house: " HDFC "
      })
    ).toEqual({
      category: "Large Cap",
      min_returns_3y: 15,
      max_expense_ratio: 1,
      fund_house: "HDFC"
    });
  });

  it("supports replace true", () => {
    expect(
      applyFilters(
        {
          category: "Small Cap",
          min_returns_5y: 20
        },
        {
          replace: true,
          category: "Debt"
        }
      )
    ).toEqual({
      category: "Debt"
    });
  });

  it("replaces conflicting sorts and defaults order", () => {
    expect(
      applyFilters(
        {
          sort_by: "returns_3y",
          order: "desc"
        },
        {
          sort_by: "expense_ratio"
        }
      )
    ).toEqual({
      sort_by: "expense_ratio",
      order: "asc"
    });
  });

  it("clears sort order when removing sort_by", () => {
    expect(
      removeFilter(
        {
          category: "Flexi Cap",
          sort_by: "returns_5y",
          order: "desc"
        },
        "sort_by"
      )
    ).toEqual({
      category: "Flexi Cap"
    });
  });

  it("removes ordinary filter chips without touching sort", () => {
    expect(
      removeFilter(
        {
          category: "ELSS",
          min_rating: 4,
          sort_by: "rating",
          order: "desc"
        },
        "min_rating"
      )
    ).toEqual({
      category: "ELSS",
      sort_by: "rating",
      order: "desc"
    });
  });

  it("normalizes invalid or empty filter values away", () => {
    expect(
      normalizeFilterState({
        fund_house: "   ",
        order: "asc",
        min_aum_cr: Number.NaN
      })
    ).toEqual({});
  });

  it("clears all filters", () => {
    expect(clearFilters()).toEqual({});
  });

  it("normalizes saved filter names", () => {
    expect(normalizeSavedFilterName("  Tax Saving  ")).toBe("tax saving");
  });
});
