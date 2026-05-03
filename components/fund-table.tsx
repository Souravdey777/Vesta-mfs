"use client";

import * as React from "react";
import { ChevronDown, ChevronsUpDown } from "lucide-react";

import { getDefaultSortOrder } from "@/lib/filters";
import {
  formatCrores,
  formatCurrency,
  formatDate,
  formatDecimal,
  formatPercent,
  formatWholeCurrency
} from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { ApplyFiltersInput, FundRow, SortField, SortOrder } from "@/lib/types";

type FundTableProps = {
  funds: FundRow[];
  onSortChange: (input: ApplyFiltersInput) => void;
  sortBy?: SortField;
  sortOrder?: SortOrder;
};

const sortableColumns: Array<{
  field: SortField;
  label: string;
}> = [
  { field: "aum", label: "AUM" },
  { field: "expense_ratio", label: "Expense" },
  { field: "returns_1y", label: "1Y" },
  { field: "returns_3y", label: "3Y" },
  { field: "returns_5y", label: "5Y" },
  { field: "rolling_returns_3y", label: "Rolling 3Y" },
  { field: "sharpe_ratio", label: "Sharpe" },
  { field: "standard_deviation", label: "Std dev" },
  { field: "rating", label: "Rating" }
];

export function FundTable({ funds, onSortChange, sortBy, sortOrder }: FundTableProps) {
  const [expandedSchemeCode, setExpandedSchemeCode] = React.useState<string | null>(null);

  function nextSortOrder(field: SortField): SortOrder {
    if (sortBy !== field) {
      return getDefaultSortOrder(field);
    }

    return sortOrder === "asc" ? "desc" : "asc";
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1120px] border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase text-muted-foreground">
            <th className="sticky left-0 z-10 bg-card px-3 py-3 font-medium">Fund</th>
            <th className="px-3 py-3 font-medium">Category</th>
            <th className="px-3 py-3 font-medium">NAV</th>
            {sortableColumns.map((column) => (
              <th className="px-3 py-3 font-medium" key={column.field}>
                <button
                  className="inline-flex items-center gap-1 rounded-sm outline-none hover:text-foreground focus:text-foreground"
                  onClick={() =>
                    onSortChange({
                      sort_by: column.field,
                      order: nextSortOrder(column.field)
                    })
                  }
                  type="button"
                >
                  {column.label}
                  <ChevronsUpDown
                    className={cn(
                      "h-3.5 w-3.5",
                      sortBy === column.field ? "text-primary" : "text-muted-foreground"
                    )}
                    aria-hidden="true"
                  />
                </button>
              </th>
            ))}
            <th className="px-3 py-3 font-medium">SIP</th>
          </tr>
        </thead>
        <tbody>
          {funds.map((fund) => {
            const expanded = expandedSchemeCode === fund.scheme_code;

            return (
              <React.Fragment key={fund.scheme_code}>
                <tr
                  className="border-b border-border align-top transition-colors hover:bg-muted/50"
                  data-testid="fund-row"
                >
                  <td className="sticky left-0 z-10 max-w-[300px] bg-card px-3 py-3">
                    <button
                      className="grid w-full grid-cols-[1fr_auto] items-start gap-2 rounded-sm text-left outline-none focus:ring-2 focus:ring-ring"
                      onClick={() =>
                        setExpandedSchemeCode(expanded ? null : fund.scheme_code)
                      }
                      type="button"
                    >
                      <span>
                        <span className="block font-medium text-foreground">{fund.scheme_name}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {fund.fund_house}
                        </span>
                      </span>
                      <ChevronDown
                        className={cn("h-4 w-4 text-muted-foreground transition-transform", expanded && "rotate-180")}
                        aria-hidden="true"
                      />
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <span className="block text-foreground">{fund.category}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{fund.plan_type}</span>
                  </td>
                  <td className="px-3 py-3">{formatCurrency(fund.nav)}</td>
                  <td className="px-3 py-3">{formatCrores(fund.aum_cr)}</td>
                  <td className="px-3 py-3">{formatPercent(fund.expense_ratio)}</td>
                  <td className="px-3 py-3">{formatPercent(fund.returns_1y)}</td>
                  <td className="px-3 py-3">{formatPercent(fund.returns_3y)}</td>
                  <td className="px-3 py-3">{formatPercent(fund.returns_5y)}</td>
                  <td className="px-3 py-3">{formatPercent(fund.rolling_returns_3y)}</td>
                  <td className="px-3 py-3">{formatDecimal(fund.sharpe_ratio)}</td>
                  <td className="px-3 py-3">{formatPercent(fund.standard_deviation)}</td>
                  <td className="px-3 py-3">{fund.rating ? `${fund.rating}/5` : "-"}</td>
                  <td className="px-3 py-3">{formatWholeCurrency(fund.min_sip)}</td>
                </tr>
                {expanded ? (
                  <tr className="border-b border-border bg-muted/40">
                    <td className="px-3 py-4" colSpan={sortableColumns.length + 4}>
                      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                        <div className="grid gap-3">
                          <p className="text-sm font-medium text-foreground">Return snapshot</p>
                          <ReturnsBars fund={fund} />
                          <p className="text-xs text-muted-foreground">
                            Updated {formatDate(fund.updated_at)}
                          </p>
                        </div>
                        <div className="grid gap-2 text-sm">
                          <div>
                            <p className="mb-2 font-medium text-foreground">Performance and risk</p>
                            <AdvancedMetrics fund={fund} />
                          </div>
                          <p>
                            <span className="font-medium text-foreground">Exit load: </span>
                            <span className="text-muted-foreground">{fund.exit_load ?? "Not available"}</span>
                          </p>
                          <p>
                            <span className="font-medium text-foreground">Sub-category: </span>
                            <span className="text-muted-foreground">{fund.sub_category ?? "-"}</span>
                          </p>
                          <p>
                            <span className="font-medium text-foreground">Scheme code: </span>
                            <span className="text-muted-foreground">{fund.scheme_code}</span>
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AdvancedMetrics({ fund }: { fund: FundRow }) {
  const metrics = [
    { label: "Rolling 3Y", value: formatPercent(fund.rolling_returns_3y) },
    { label: "Sharpe", value: formatDecimal(fund.sharpe_ratio) },
    { label: "Std dev", value: formatPercent(fund.standard_deviation) },
    { label: "Beta", value: formatDecimal(fund.beta) },
    { label: "Upside capture", value: formatPercent(fund.upside_capture_ratio) },
    { label: "Downside capture", value: formatPercent(fund.downside_capture_ratio) }
  ];

  return (
    <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-background p-3 sm:grid-cols-3">
      {metrics.map((metric) => (
        <div key={metric.label}>
          <p className="text-xs text-muted-foreground">{metric.label}</p>
          <p className="mt-1 font-medium text-foreground">{metric.value}</p>
        </div>
      ))}
    </div>
  );
}

function ReturnsBars({ fund }: { fund: FundRow }) {
  const values = [
    { label: "1Y", value: fund.returns_1y },
    { label: "3Y", value: fund.returns_3y },
    { label: "5Y", value: fund.returns_5y }
  ];
  const maxValue = Math.max(
    1,
    ...values.map((item) => (typeof item.value === "number" ? Math.abs(item.value) : 0))
  );

  return (
    <div className="grid gap-2 rounded-md border border-border bg-background p-3">
      {values.map((item) => {
        const width = item.value === null || item.value === undefined ? 0 : Math.max(4, (Math.abs(item.value) / maxValue) * 100);

        return (
          <div className="grid grid-cols-[2rem_1fr_4rem] items-center gap-2" key={item.label}>
            <span className="text-xs text-muted-foreground">{item.label}</span>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full", (item.value ?? 0) >= 0 ? "bg-primary" : "bg-destructive")}
                style={{
                  width: `${width}%`
                }}
              />
            </div>
            <span className="text-right text-xs text-muted-foreground">{formatPercent(item.value)}</span>
          </div>
        );
      })}
    </div>
  );
}
