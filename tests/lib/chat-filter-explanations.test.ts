import { describe, expect, it } from "vitest";

import {
  buildAppliedFiltersMessage,
  buildLoadedFiltersMessage
} from "@/lib/chat-filter-explanations";

describe("chat filter explanations", () => {
  it("summarizes applied filters and explains why they were used", () => {
    expect(
      buildAppliedFiltersMessage({
        category: "Large Cap",
        limit: 5,
        min_returns_3y: 15,
        sort_by: "returns_3y",
        order: "desc"
      })
    ).toBe(
      [
        "**Applied filters**",
        "- Category: Large Cap",
        "- Top 5",
        "- 3Y returns >= 15.00%",
        "- Sort: 3Y returns desc",
        "",
        "**Why these filters**",
        "- category narrows the universe to the requested segment",
        "- return floors keep rows that meet the requested threshold",
        "- sorting brings the requested metric to the front",
        "- limit keeps only the requested number of top rows",
        "",
        "_Check the results table for fund names and metrics._"
      ].join("\n")
    );
  });

  it("explains loaded saved-filter constraints", () => {
    expect(
      buildLoadedFiltersMessage("Tax saver screen", {
        category: "ELSS",
        sort_by: "returns_3y",
        order: "desc"
      })
    ).toBe(
      [
        "Loaded Tax saver screen.",
        "",
        "**Applied filters**",
        "- Category: ELSS",
        "- Sort: 3Y returns desc",
        "",
        "**Why these filters**",
        "- These are the constraints saved in that screen",
        "",
        "_Check the results table for fund names and metrics._"
      ].join("\n")
    );
  });
});
