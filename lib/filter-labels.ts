import { formatCrores, formatDecimal, formatPercent } from "@/lib/formatters";
import type { FilterKey, FilterState, SortField } from "@/lib/types";

export type FilterChip = {
  key: FilterKey;
  label: string;
};

const SORT_LABELS: Record<SortField, string> = {
  aum: "AUM",
  expense_ratio: "expense ratio",
  rating: "rating",
  beta: "beta",
  downside_capture_ratio: "downside capture",
  rolling_returns_3y: "rolling 3Y returns",
  returns_1y: "1Y returns",
  returns_3y: "3Y returns",
  returns_5y: "5Y returns",
  sharpe_ratio: "Sharpe ratio",
  standard_deviation: "standard deviation",
  upside_capture_ratio: "upside capture"
};

export function getFilterChips(filters: FilterState): FilterChip[] {
  const chips: FilterChip[] = [];

  if (filters.category) {
    chips.push({
      key: "category",
      label: `Category: ${filters.category}`
    });
  }

  if (filters.plan_type) {
    chips.push({
      key: "plan_type",
      label: `Plan: ${filters.plan_type}`
    });
  }

  if (filters.fund_house) {
    chips.push({
      key: "fund_house",
      label: `Fund house: ${filters.fund_house}`
    });
  }

  if (filters.min_aum_cr !== undefined) {
    chips.push({
      key: "min_aum_cr",
      label: `AUM >= ${formatCrores(filters.min_aum_cr)}`
    });
  }

  if (filters.max_expense_ratio !== undefined) {
    chips.push({
      key: "max_expense_ratio",
      label: `Expense <= ${formatPercent(filters.max_expense_ratio)}`
    });
  }

  if (filters.min_returns_1y !== undefined) {
    chips.push({
      key: "min_returns_1y",
      label: `1Y returns >= ${formatPercent(filters.min_returns_1y)}`
    });
  }

  if (filters.min_returns_3y !== undefined) {
    chips.push({
      key: "min_returns_3y",
      label: `3Y returns >= ${formatPercent(filters.min_returns_3y)}`
    });
  }

  if (filters.min_returns_5y !== undefined) {
    chips.push({
      key: "min_returns_5y",
      label: `5Y returns >= ${formatPercent(filters.min_returns_5y)}`
    });
  }

  if (filters.min_rolling_returns_3y !== undefined) {
    chips.push({
      key: "min_rolling_returns_3y",
      label: `Rolling 3Y >= ${formatPercent(filters.min_rolling_returns_3y)}`
    });
  }

  if (filters.min_sharpe_ratio !== undefined) {
    chips.push({
      key: "min_sharpe_ratio",
      label: `Sharpe >= ${formatDecimal(filters.min_sharpe_ratio)}`
    });
  }

  if (filters.max_standard_deviation !== undefined) {
    chips.push({
      key: "max_standard_deviation",
      label: `Std dev <= ${formatPercent(filters.max_standard_deviation)}`
    });
  }

  if (filters.max_beta !== undefined) {
    chips.push({
      key: "max_beta",
      label: `Beta <= ${formatDecimal(filters.max_beta)}`
    });
  }

  if (filters.min_upside_capture_ratio !== undefined) {
    chips.push({
      key: "min_upside_capture_ratio",
      label: `Upside capture >= ${formatPercent(filters.min_upside_capture_ratio)}`
    });
  }

  if (filters.max_downside_capture_ratio !== undefined) {
    chips.push({
      key: "max_downside_capture_ratio",
      label: `Downside capture <= ${formatPercent(filters.max_downside_capture_ratio)}`
    });
  }

  if (filters.min_rating !== undefined) {
    chips.push({
      key: "min_rating",
      label: `Rating >= ${filters.min_rating}`
    });
  }

  if (filters.sort_by) {
    chips.push({
      key: "sort_by",
      label: `Sort: ${SORT_LABELS[filters.sort_by]} ${filters.order ?? "desc"}`
    });
  }

  return chips;
}
