import { getFilterChips } from "@/lib/filter-labels";
import type { FilterKey, FilterState } from "@/lib/types";

const RESULT_SOURCE_SENTENCE = "Check the results table for fund names and metrics.";

export function buildAppliedFiltersMessage(filters: FilterState): string {
  const chips = getFilterChips(filters);

  if (chips.length === 0) {
    return [
      "**Applied filters**",
      "- None",
      "",
      "**Why these filters**",
      "- The request did not map to an active supported filter, so the table stays broad",
      "",
      `_${RESULT_SOURCE_SENTENCE}_`
    ].join("\n");
  }

  return [
    "**Applied filters**",
    ...chips.map((chip) => `- ${chip.label}`),
    "",
    "**Why these filters**",
    ...buildFilterReasons(filters, chips.map((chip) => chip.key)).map((reason) => `- ${reason}`),
    "",
    `_${RESULT_SOURCE_SENTENCE}_`
  ].join("\n");
}

export function buildLoadedFiltersMessage(name: string, filters: FilterState): string {
  const chips = getFilterChips(filters);

  if (chips.length === 0) {
    return [
      `Loaded ${name}.`,
      "",
      "**Applied filters**",
      "- None",
      "",
      `_${RESULT_SOURCE_SENTENCE}_`
    ].join("\n");
  }

  return [
    `Loaded ${name}.`,
    "",
    "**Applied filters**",
    ...chips.map((chip) => `- ${chip.label}`),
    "",
    "**Why these filters**",
    "- These are the constraints saved in that screen",
    "",
    `_${RESULT_SOURCE_SENTENCE}_`
  ].join("\n");
}

function buildFilterReasons(filters: FilterState, keys: FilterKey[]): string[] {
  const keySet = new Set(keys);
  const reasons: string[] = [];

  if (keySet.has("category")) {
    reasons.push("category narrows the universe to the requested segment");
  }

  if (keySet.has("fund_house")) {
    reasons.push("fund house keeps rows tied to the requested AMC");
  }

  if (keySet.has("plan_type")) {
    reasons.push("plan type matches the requested plan structure");
  }

  if (
    keySet.has("min_returns_1y") ||
    keySet.has("min_returns_3y") ||
    keySet.has("min_returns_5y") ||
    keySet.has("min_rolling_returns_3y")
  ) {
    reasons.push("return floors keep rows that meet the requested threshold");
  }

  if (keySet.has("max_expense_ratio")) {
    reasons.push("expense cap keeps lower-cost rows in view");
  }

  if (keySet.has("min_aum_cr")) {
    reasons.push("AUM floor keeps larger funds in view");
  }

  if (
    keySet.has("min_sharpe_ratio") ||
    keySet.has("max_standard_deviation") ||
    keySet.has("max_beta") ||
    keySet.has("min_upside_capture_ratio") ||
    keySet.has("max_downside_capture_ratio")
  ) {
    reasons.push("risk metric bounds keep the table aligned with the requested risk profile");
  }

  if (keySet.has("min_rating")) {
    reasons.push("rating floor keeps rows at or above the requested rating");
  }

  if (filters.sort_by) {
    reasons.push("sorting brings the requested metric to the front");
  }

  if (keySet.has("limit")) {
    reasons.push("limit keeps only the requested number of top rows");
  }

  if (reasons.length === 0) {
    return ["These structured filters translate your request into table constraints"];
  }

  return reasons.slice(0, 4);
}
