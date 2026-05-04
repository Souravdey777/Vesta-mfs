"use client";

import { AlertCircle, BarChart3, RefreshCw, SearchX, SlidersHorizontal } from "lucide-react";

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
    <section className="flex min-h-[calc(100vh-8rem)] flex-col rounded-lg border border-border bg-card">
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

      <div className="grid gap-4 p-4">
        <FilterChips filters={filters} onClearAll={clearFilters} onRemove={removeFilter} />
        {renderBody()}
      </div>
    </section>
  );

  function renderBody() {
    if (!hasActiveFilters) {
      return (
        <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border p-6 text-center">
          <BarChart3 className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="max-w-md text-sm text-muted-foreground">
            Add a screen from chat to load funds from the data table.
          </p>
        </div>
      );
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
      <FundTable
        categoryBenchmarks={fundsResult.data.categoryBenchmarks}
        funds={fundsResult.data.funds}
        onSortChange={applyFilters}
        sortBy={filters.sort_by}
        sortOrder={filters.order}
      />
    );
  }
}
