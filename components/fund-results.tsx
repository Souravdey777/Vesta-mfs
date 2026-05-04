"use client";

import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  SearchX,
  SlidersHorizontal
} from "lucide-react";

import { FilterChips } from "@/components/filter-chips";
import { FundTable } from "@/components/fund-table";
import { SavedFiltersDropdown } from "@/components/saved-filters-dropdown";
import { Button } from "@/components/ui/button";
import type { UseFundsResult } from "@/hooks/use-funds";
import { formatNumber } from "@/lib/formatters";
import { useFiltersStore } from "@/lib/store/filters";

type FundResultsProps = {
  fundsResult: UseFundsResult;
  showSavedFilters?: boolean;
};

export function FundResults({ fundsResult, showSavedFilters = true }: FundResultsProps) {
  const filters = useFiltersStore((state) => state.filters);
  const applyFilters = useFiltersStore((state) => state.applyFilters);
  const clearFilters = useFiltersStore((state) => state.clearFilters);
  const removeFilter = useFiltersStore((state) => state.removeFilter);
  const hasActiveFilters = Object.keys(filters).length > 0;

  return (
    <section className="flex min-h-[calc(100vh-8rem)] flex-col rounded-lg border border-border bg-card lg:h-full lg:min-h-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Results
          {fundsResult.data ? (
            <span className="rounded-sm bg-muted px-2 py-0.5 text-xs">
              {filters.limit && fundsResult.data.total > fundsResult.data.funds.length
                ? `${formatNumber(fundsResult.data.funds.length)} of ${formatNumber(
                    fundsResult.data.total
                  )} funds`
                : `${formatNumber(fundsResult.data.total)} funds`}
            </span>
          ) : null}
        </div>
        {showSavedFilters ? <SavedFiltersDropdown /> : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4">
        <FilterChips filters={filters} onClearAll={clearFilters} onRemove={removeFilter} />
        {renderBody()}
      </div>
    </section>
  );

  function renderBody() {
    if (!hasActiveFilters) {
      return <EmptyResultsTablePreview />;
    }

    if (fundsResult.status === "loading") {
      return (
        <div
          className="grid min-h-[420px] content-start gap-2"
          aria-label="Loading funds"
          aria-live="polite"
          role="status"
        >
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              className="grid h-12 animate-pulse grid-cols-[minmax(0,1.8fr)_repeat(2,minmax(0,1fr))] items-center gap-3 rounded-md border border-border bg-background px-3 sm:grid-cols-[minmax(12rem,1.8fr)_repeat(4,minmax(5rem,1fr))]"
              key={index}
            >
              <span className="h-4 rounded-sm bg-muted" />
              <span className="h-4 rounded-sm bg-muted" />
              <span className="h-4 rounded-sm bg-muted" />
              <span className="hidden h-4 rounded-sm bg-muted sm:block" />
              <span className="hidden h-4 rounded-sm bg-muted sm:block" />
            </div>
          ))}
        </div>
      );
    }

    if (fundsResult.status === "error") {
      return (
        <div
          className="flex min-h-[360px] flex-col items-center justify-center gap-3 rounded-md border border-border p-6 text-center"
          aria-live="assertive"
          role="alert"
        >
          <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            {fundsResult.error ?? "Unable to load funds right now."}
          </p>
          <Button variant="outline" onClick={fundsResult.refetch}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Retry
          </Button>
        </div>
      );
    }

    if (fundsResult.data?.zeroState) {
      return (
        <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 rounded-md border border-border p-6 text-center">
          <SearchX className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="max-w-md text-sm text-muted-foreground">
            {fundsResult.data.zeroState.message}
          </p>
          {fundsResult.data.zeroState.suggestions.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-2">
              {fundsResult.data.zeroState.suggestions.map((suggestion) => (
                <Button
                  key={suggestion.removeFilter}
                  variant="outline"
                  onClick={() => removeFilter(suggestion.removeFilter)}
                >
                  {suggestion.label}
                </Button>
              ))}
            </div>
          ) : (
            <p className="max-w-md text-sm text-muted-foreground">
              Try removing a filter or starting with a broader category.
            </p>
          )}
        </div>
      );
    }

    if (!fundsResult.data || fundsResult.data.funds.length === 0) {
      return (
        <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 rounded-md border border-border p-6 text-center">
          <SearchX className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="max-w-md text-sm text-muted-foreground">
            No funds matched this screen. Try clearing a filter or using a broader category.
          </p>
        </div>
      );
    }

    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border bg-card">
        <FundTable
          categoryBenchmarks={fundsResult.data.categoryBenchmarks}
          funds={fundsResult.data.funds}
          onSortChange={applyFilters}
          sortBy={filters.sort_by}
          sortOrder={filters.order}
        />
        <FundsPagination data={fundsResult.data} onPageChange={fundsResult.setPage} />
      </div>
    );
  }
}

const emptyPreviewColumns = [
  {
    align: "text-left",
    label: "Fund",
    width: "w-[26%]"
  },
  {
    align: "text-left",
    label: "Category",
    width: "w-[11%]"
  },
  {
    align: "text-right",
    label: "NAV",
    width: "w-[8%]"
  },
  {
    align: "text-right",
    label: "AUM",
    width: "w-[12%]"
  },
  {
    align: "text-right",
    label: "Expense",
    width: "w-[8%]"
  },
  {
    align: "text-right",
    label: "3Y",
    width: "w-[8%]"
  },
  {
    align: "text-right",
    label: "Vs cat.",
    width: "w-[8%]"
  },
  {
    align: "text-right",
    label: "Rating",
    width: "w-[7%]"
  },
  {
    align: "text-right",
    label: "SIP",
    width: "w-[7%]"
  }
] as const;

const emptyPreviewRows = [
  ["w-4/5", "w-3/4", "w-2/3", "w-3/4", "w-1/2", "w-1/2", "w-1/2", "w-1/3", "w-1/2"],
  ["w-2/3", "w-4/5", "w-1/2", "w-2/3", "w-2/3", "w-2/3", "w-1/3", "w-1/2", "w-2/3"],
  ["w-3/4", "w-2/3", "w-3/5", "w-4/5", "w-1/2", "w-1/2", "w-2/3", "w-1/3", "w-1/2"],
  ["w-1/2", "w-3/4", "w-2/3", "w-3/4", "w-2/3", "w-2/3", "w-1/2", "w-1/2", "w-2/3"]
] as const;

function EmptyResultsTablePreview() {
  return (
    <div className="relative flex min-h-[420px] flex-1 overflow-hidden rounded-md border border-border bg-card">
      <div className="min-h-0 flex-1 overflow-auto">
        <table
          aria-label="Fund results preview"
          className="w-full min-w-[940px] table-fixed border-separate border-spacing-0 text-left text-sm"
        >
          <colgroup>
            {emptyPreviewColumns.map((column) => (
              <col className={column.width} key={column.label} />
            ))}
          </colgroup>
          <thead>
            <tr className="text-[11px] uppercase text-muted-foreground">
              {emptyPreviewColumns.map((column, index) => (
                <th
                  className={`sticky top-0 h-10 border-b border-border bg-muted py-2 font-medium ${column.align} ${
                    index === 0 ? "left-0 z-30 px-3" : "z-20 px-2.5"
                  }`}
                  key={column.label}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody aria-hidden="true">
            {emptyPreviewRows.map((row, rowIndex) => (
              <tr className="border-b border-border align-top" key={rowIndex}>
                {row.map((width, columnIndex) => (
                  <td
                    className={`${columnIndex === 0 ? "sticky left-0 z-10 bg-card px-3" : "px-2.5"} py-2.5`}
                    key={`${rowIndex}-${columnIndex}`}
                  >
                    <span
                      className={`block h-4 rounded-sm bg-muted/70 ${width} ${
                        columnIndex === 0 ? "" : "ml-auto"
                      }`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center">
        <div className="max-w-md bg-card/90 px-4 py-3">
          <h2 className="text-sm font-medium text-foreground">No fund screen yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask a question in chat or pick a saved filter to load matching mutual funds here.
          </p>
        </div>
      </div>
    </div>
  );
}

function FundsPagination({
  data,
  onPageChange
}: {
  data: NonNullable<UseFundsResult["data"]>;
  onPageChange: (page: number) => void;
}) {
  const page = data.pageCount === 0 ? 0 : data.page;
  const firstItem = data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1;
  const lastItem = Math.min(data.page * data.pageSize, data.total);
  const hasPreviousPage = data.page > 1;
  const hasNextPage = data.page < data.pageCount;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/20 px-3 py-3">
      <p className="text-sm text-muted-foreground">
        {formatNumber(firstItem)}-{formatNumber(lastItem)} of {formatNumber(data.total)} funds
      </p>
      <div className="flex items-center gap-2">
        <Button
          disabled={!hasPreviousPage}
          onClick={() => onPageChange(data.page - 1)}
          size="sm"
          type="button"
          variant="outline"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Previous
        </Button>
        <span className="min-w-[6.5rem] text-center text-sm text-muted-foreground">
          Page {formatNumber(page)} of {formatNumber(data.pageCount)}
        </span>
        <Button
          disabled={!hasNextPage}
          onClick={() => onPageChange(data.page + 1)}
          size="sm"
          type="button"
          variant="outline"
        >
          Next
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
