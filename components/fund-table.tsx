"use client";

import * as React from "react";
import { ChevronsUpDown, PanelRightOpen } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { getDefaultSortOrder } from "@/lib/filters";
import {
  formatCrores,
  formatCurrency,
  formatDate,
  formatDecimal,
  formatNumber,
  formatPercent,
  formatWholeCurrency
} from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type {
  ApplyFiltersInput,
  CategoryBenchmark,
  FundCategory,
  FundRow,
  PlanType,
  SortField,
  SortOrder
} from "@/lib/types";

type FundTableProps = {
  categoryBenchmarks?: CategoryBenchmark[];
  funds: FundRow[];
  onSortChange: (input: ApplyFiltersInput) => void;
  sortBy?: SortField;
  sortOrder?: SortOrder;
};

const FIELD_DESCRIPTIONS = {
  nav: "Latest net asset value per unit.",
  aum: "Assets under management, shown in crores.",
  expense: "Annual expense ratio charged by the plan.",
  returns1y: "Annualized return over the last 1 year.",
  returns3y: "Annualized return over the last 3 years.",
  returns5y: "Annualized return over the last 5 years.",
  rollingReturns3y: "Rolling 3-year return across available periods.",
  vsCategory: "Difference between this fund and the matching category median.",
  sip: "Minimum monthly SIP amount.",
  minimumSip: "Minimum monthly SIP amount.",
  sharpe: "Risk-adjusted return. Higher values indicate more return per unit of volatility.",
  standardDeviation: "Return volatility. Lower values usually mean steadier returns.",
  beta: "Sensitivity to market movement. A value near 1 moves broadly with the market.",
  upsideCapture: "How much of benchmark gains the fund captured in up markets.",
  downsideCapture: "How much of benchmark losses the fund captured in down markets.",
  categoryMedian: "Median value for funds in the same category and plan type.",
  vsMedian: "Fund value minus peer median. Green means favorable for the metric."
};

export function FundTable({
  categoryBenchmarks = [],
  funds,
  onSortChange,
  sortBy,
  sortOrder
}: FundTableProps) {
  const [selectedFund, setSelectedFund] = React.useState<FundRow | null>(null);
  const benchmarksByPeerGroup = React.useMemo(() => {
    const benchmarks = new Map<string, CategoryBenchmark>();

    for (const benchmark of categoryBenchmarks) {
      benchmarks.set(getBenchmarkKey(benchmark.category, benchmark.plan_type), benchmark);
    }

    return benchmarks;
  }, [categoryBenchmarks]);
  const selectedFundBenchmark = selectedFund
    ? benchmarksByPeerGroup.get(getBenchmarkKey(selectedFund.category, selectedFund.plan_type))
    : undefined;

  function nextSortOrder(field: SortField): SortOrder {
    if (sortBy !== field) {
      return getDefaultSortOrder(field);
    }

    return sortOrder === "asc" ? "desc" : "asc";
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full min-w-[940px] table-fixed border-separate border-spacing-0 text-left text-sm">
        <colgroup>
          <col className="w-[26%]" />
          <col className="w-[11%]" />
          <col className="w-[8%]" />
          <col className="w-[12%]" />
          <col className="w-[8%]" />
          <col className="w-[8%]" />
          <col className="w-[8%]" />
          <col className="w-[7%]" />
          <col className="w-[7%]" />
        </colgroup>
        <thead>
          <tr className="text-[11px] uppercase text-muted-foreground">
            <th className="sticky left-0 top-0 z-30 h-10 border-b border-border bg-muted px-3 py-2 font-medium">
              <FieldLabel label="Fund" />
            </th>
            <th className="sticky top-0 z-20 h-10 border-b border-border bg-muted px-2.5 py-2 font-medium">
              <FieldLabel label="Category" />
            </th>
            <th className="sticky top-0 z-20 h-10 border-b border-border bg-muted px-2.5 py-2 text-right font-medium">
              <FieldLabel align="end" label="NAV" description={FIELD_DESCRIPTIONS.nav} />
            </th>
            <SortableHeader
              description={FIELD_DESCRIPTIONS.aum}
              field="aum"
              label="AUM"
              nextSortOrder={nextSortOrder}
              onSortChange={onSortChange}
              sortBy={sortBy}
            />
            <SortableHeader
              description={FIELD_DESCRIPTIONS.expense}
              field="expense_ratio"
              label="Expense"
              nextSortOrder={nextSortOrder}
              onSortChange={onSortChange}
              sortBy={sortBy}
            />
            <SortableHeader
              description={FIELD_DESCRIPTIONS.returns3y}
              field="returns_3y"
              label="3Y"
              nextSortOrder={nextSortOrder}
              onSortChange={onSortChange}
              sortBy={sortBy}
            />
            <th className="sticky top-0 z-20 h-10 border-b border-border bg-muted px-2.5 py-2 text-right font-medium">
              <FieldLabel
                align="end"
                label="Vs cat."
                description={FIELD_DESCRIPTIONS.vsCategory}
              />
            </th>
            <SortableHeader
              field="rating"
              label="Rating"
              nextSortOrder={nextSortOrder}
              onSortChange={onSortChange}
              sortBy={sortBy}
            />
            <th className="sticky top-0 z-20 h-10 border-b border-border bg-muted px-2.5 py-2 text-right font-medium">
              <FieldLabel
                align="end"
                label="SIP"
                description={FIELD_DESCRIPTIONS.sip}
              />
            </th>
          </tr>
        </thead>
        <tbody>
          {funds.map((fund) => {
            const benchmark = benchmarksByPeerGroup.get(
              getBenchmarkKey(fund.category, fund.plan_type)
            );

            return (
              <tr
                className={cn(
                  "border-b border-border align-top transition-colors hover:bg-muted/50",
                  selectedFund?.scheme_code === fund.scheme_code && "bg-muted/40"
                )}
                data-testid="fund-row"
                key={fund.scheme_code}
              >
                <td className="sticky left-0 z-10 bg-card px-3 py-2.5">
                  <button
                    aria-label={`Open details for ${fund.scheme_name}`}
                    className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-sm text-left outline-none focus:ring-2 focus:ring-ring"
                    onClick={() => setSelectedFund(fund)}
                    type="button"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-foreground" title={fund.scheme_name}>
                        {fund.scheme_name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {fund.fund_house}
                      </span>
                    </span>
                    <PanelRightOpen className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </button>
                </td>
                <td className="px-2.5 py-2.5">
                  <span className="block truncate text-foreground">{fund.category}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{fund.plan_type}</span>
                </td>
                <td className="whitespace-nowrap px-2.5 py-2.5 text-right tabular-nums">
                  {formatCurrency(fund.nav)}
                </td>
                <td className="whitespace-nowrap px-2.5 py-2.5 text-right tabular-nums">
                  {formatCrores(fund.aum_cr)}
                </td>
                <td className="whitespace-nowrap px-2.5 py-2.5 text-right tabular-nums">
                  {formatPercent(fund.expense_ratio)}
                </td>
                <td className="whitespace-nowrap px-2.5 py-2.5 text-right font-medium tabular-nums">
                  {formatPercent(fund.returns_3y)}
                </td>
                <td className="whitespace-nowrap px-2.5 py-2.5 text-right tabular-nums">
                  <BenchmarkDeltaLabel
                    benchmarkValue={benchmark?.returns_3y}
                    fundValue={fund.returns_3y}
                    higherIsBetter
                    unit="percent"
                  />
                </td>
                <td className="whitespace-nowrap px-2.5 py-2.5 text-right tabular-nums">
                  {fund.rating ? `${fund.rating}/5` : "-"}
                </td>
                <td className="whitespace-nowrap px-2.5 py-2.5 text-right tabular-nums">
                  {formatWholeCurrency(fund.min_sip)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <FundDetailsDrawer
        benchmark={selectedFundBenchmark}
        fund={selectedFund}
        onOpenChange={(open) => !open && setSelectedFund(null)}
      />
    </div>
  );
}

function SortableHeader({
  description,
  field,
  label,
  nextSortOrder,
  onSortChange,
  sortBy
}: {
  description?: string;
  field: SortField;
  label: string;
  nextSortOrder: (field: SortField) => SortOrder;
  onSortChange: (input: ApplyFiltersInput) => void;
  sortBy?: SortField;
}) {
  const tooltipId = React.useId();

  return (
    <th className="sticky top-0 z-20 h-10 border-b border-border bg-muted px-2.5 py-2 text-right font-medium">
      <button
        className={cn(
          "group relative inline-flex items-center justify-end gap-1 rounded-sm outline-none hover:text-foreground focus:text-foreground",
          description && "cursor-help"
        )}
        onClick={() =>
          onSortChange({
            sort_by: field,
            order: nextSortOrder(field)
          })
        }
        title={description}
        type="button"
      >
        <span className={cn(description && "decoration-dotted underline-offset-4 group-hover:underline group-focus:underline")}>
          {label}
        </span>
        <ChevronsUpDown
          className={cn(
            "h-3.5 w-3.5",
            sortBy === field ? "text-primary" : "text-muted-foreground"
          )}
          aria-hidden="true"
        />
        {description ? (
          <TooltipContent align="end" description={description} id={tooltipId} />
        ) : null}
      </button>
    </th>
  );
}

function FundDetailsDrawer({
  benchmark,
  fund,
  onOpenChange
}: {
  benchmark?: CategoryBenchmark;
  fund: FundRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(fund)} onOpenChange={onOpenChange}>
      <DialogContent className="left-auto right-0 top-0 h-dvh w-full max-w-xl translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none border-y-0 border-l bg-background p-0 shadow-xl sm:w-[min(34rem,calc(100vw-2rem))] data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right">
        {fund ? (
          <div className="flex h-full min-h-0 flex-col">
            <DialogHeader className="border-b border-border p-5 pr-12">
              <DialogTitle className="text-base leading-6">{fund.scheme_name}</DialogTitle>
              <DialogDescription>
                {fund.fund_house} · {fund.category} · {fund.plan_type}
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <FundDetails benchmark={benchmark} fund={fund} />
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function FundDetails({
  benchmark,
  fund
}: {
  benchmark?: CategoryBenchmark;
  fund: FundRow;
}) {
  return (
    <div className="grid gap-5 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <MetricTile
          label="NAV"
          value={formatCurrency(fund.nav)}
        />
        <MetricTile
          label="AUM"
          description={FIELD_DESCRIPTIONS.aum}
          value={formatCrores(fund.aum_cr)}
        />
        <MetricTile
          label="Expense"
          description={FIELD_DESCRIPTIONS.expense}
          value={formatPercent(fund.expense_ratio)}
        />
        <MetricTile
          label="Minimum SIP"
          description={FIELD_DESCRIPTIONS.minimumSip}
          value={formatWholeCurrency(fund.min_sip)}
        />
      </div>

      <section className="grid gap-3">
        <p className="font-medium text-foreground">Return snapshot</p>
        <ReturnsBars fund={fund} />
        <p className="text-xs text-muted-foreground">Updated {formatDate(fund.updated_at)}</p>
      </section>

      <section className="grid gap-3">
        <p className="font-medium text-foreground">Performance and risk</p>
        <AdvancedMetrics fund={fund} />
      </section>

      <section className="grid gap-3">
        <div>
          <p className="font-medium text-foreground">Vs category median</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {benchmark
              ? `${benchmark.plan_type} ${benchmark.category} peer median · ${formatNumber(
                  benchmark.fundCount
                )} funds`
              : "Category peer median unavailable"}
          </p>
        </div>
        <BenchmarkComparison benchmark={benchmark} fund={fund} />
      </section>

      <section className="grid gap-2 border-t border-border pt-4">
        <DetailLine
          label="Exit load"
          value={fund.exit_load ?? "Not available"}
        />
        <DetailLine
          label="Sub-category"
          value={fund.sub_category ?? "-"}
        />
        <DetailLine
          label="Rating"
          value={fund.rating ? `${fund.rating}/5` : "-"}
        />
        <DetailLine
          label="Scheme code"
          value={fund.scheme_code}
        />
      </section>
    </div>
  );
}

function MetricTile({
  description,
  label,
  value
}: {
  description?: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <FieldLabel
        label={label}
        description={description}
        className="text-xs text-muted-foreground"
      />
      <p className="mt-1 font-medium text-foreground">{value}</p>
    </div>
  );
}

function DetailLine({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <p>
      <span className="font-medium text-foreground">{label}: </span>
      <span className="text-muted-foreground">{value}</span>
    </p>
  );
}

function AdvancedMetrics({ fund }: { fund: FundRow }) {
  const metrics = [
    {
      description: FIELD_DESCRIPTIONS.rollingReturns3y,
      label: "Rolling 3Y",
      value: formatPercent(fund.rolling_returns_3y)
    },
    {
      description: FIELD_DESCRIPTIONS.sharpe,
      label: "Sharpe",
      value: formatDecimal(fund.sharpe_ratio)
    },
    {
      description: FIELD_DESCRIPTIONS.standardDeviation,
      label: "Std dev",
      value: formatPercent(fund.standard_deviation)
    },
    {
      description: FIELD_DESCRIPTIONS.beta,
      label: "Beta",
      value: formatDecimal(fund.beta)
    },
    {
      description: FIELD_DESCRIPTIONS.upsideCapture,
      label: "Upside capture",
      value: formatPercent(fund.upside_capture_ratio)
    },
    {
      description: FIELD_DESCRIPTIONS.downsideCapture,
      label: "Downside capture",
      value: formatPercent(fund.downside_capture_ratio)
    }
  ];

  return (
    <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-background p-3 sm:grid-cols-3">
      {metrics.map((metric) => (
        <div key={metric.label}>
          <FieldLabel
            label={metric.label}
            description={metric.description}
            className="text-xs text-muted-foreground"
          />
          <p className="mt-1 font-medium text-foreground">{metric.value}</p>
        </div>
      ))}
    </div>
  );
}

function BenchmarkComparison({
  benchmark,
  fund
}: {
  benchmark?: CategoryBenchmark;
  fund: FundRow;
}) {
  const metrics = [
    {
      benchmarkValue: benchmark?.returns_1y,
      formatter: formatPercent,
      fundValue: fund.returns_1y,
      higherIsBetter: true,
      label: "1Y return",
      unit: "percent" as const
    },
    {
      benchmarkValue: benchmark?.returns_3y,
      formatter: formatPercent,
      fundValue: fund.returns_3y,
      higherIsBetter: true,
      label: "3Y return",
      unit: "percent" as const
    },
    {
      benchmarkValue: benchmark?.returns_5y,
      formatter: formatPercent,
      fundValue: fund.returns_5y,
      higherIsBetter: true,
      label: "5Y return",
      unit: "percent" as const
    },
    {
      benchmarkValue: benchmark?.sharpe_ratio,
      formatter: formatDecimal,
      fundValue: fund.sharpe_ratio,
      higherIsBetter: true,
      label: "Sharpe",
      unit: "decimal" as const
    },
    {
      benchmarkValue: benchmark?.expense_ratio,
      formatter: formatPercent,
      fundValue: fund.expense_ratio,
      higherIsBetter: false,
      label: "Expense",
      unit: "percent" as const
    },
    {
      benchmarkValue: benchmark?.standard_deviation,
      formatter: formatPercent,
      fundValue: fund.standard_deviation,
      higherIsBetter: false,
      label: "Std dev",
      unit: "percent" as const
    }
  ];

  return (
    <div className="overflow-hidden rounded-md border border-border bg-background">
      <div className="grid grid-cols-[minmax(6.5rem,1fr)_4.5rem_4.5rem_4rem] gap-2 border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
        <FieldLabel label="Metric" />
        <FieldLabel align="end" label="Fund" />
        <FieldLabel
          align="end"
          label="Median"
          description={FIELD_DESCRIPTIONS.categoryMedian}
        />
        <FieldLabel
          align="end"
          label="Vs"
          description={FIELD_DESCRIPTIONS.vsMedian}
        />
      </div>
      {metrics.map((metric) => (
        <div
          className="grid grid-cols-[minmax(6.5rem,1fr)_4.5rem_4.5rem_4rem] gap-2 px-3 py-2 text-xs"
          key={metric.label}
        >
          <span className="text-muted-foreground">{metric.label}</span>
          <span className="text-right text-foreground">{metric.formatter(metric.fundValue)}</span>
          <span className="text-right text-muted-foreground">
            {metric.formatter(metric.benchmarkValue)}
          </span>
          <span className="text-right">
            <BenchmarkDeltaLabel
              benchmarkValue={metric.benchmarkValue}
              fundValue={metric.fundValue}
              higherIsBetter={metric.higherIsBetter}
              unit={metric.unit}
            />
          </span>
        </div>
      ))}
    </div>
  );
}

function ReturnsBars({ fund }: { fund: FundRow }) {
  const values = [
    {
      label: "1Y",
      value: fund.returns_1y
    },
    {
      label: "3Y",
      value: fund.returns_3y
    },
    {
      label: "5Y",
      value: fund.returns_5y
    }
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
          <div className="grid grid-cols-[3rem_1fr_4rem] items-center gap-2" key={item.label}>
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

function FieldLabel({
  align = "start",
  className,
  description,
  label
}: {
  align?: "start" | "end";
  className?: string;
  description?: string;
  label: string;
}) {
  const tooltipId = React.useId();

  if (!description) {
    return (
      <span
        className={cn(
          "inline-flex min-w-0 items-center",
          align === "end" && "justify-end",
          className
        )}
      >
        <span className="truncate">{label}</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "group relative inline-flex min-w-0 cursor-help items-center decoration-dotted underline-offset-4 outline-none hover:underline focus:underline focus-visible:ring-2 focus-visible:ring-ring",
        align === "end" && "justify-end",
        className
      )}
      tabIndex={0}
      title={description}
    >
      <span className="truncate">{label}</span>
      <TooltipContent align={align} description={description} id={tooltipId} />
    </span>
  );
}

function TooltipContent({
  align = "start",
  description,
  id
}: {
  align?: "start" | "end";
  description: string;
  id: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute top-full z-50 mt-2 hidden w-56 rounded-md border border-border bg-popover px-3 py-2 text-left text-xs font-normal leading-5 text-popover-foreground shadow-lg normal-case tracking-normal group-hover:block group-focus:block",
        align === "end" ? "right-0" : "left-0"
      )}
      id={id}
      role="tooltip"
    >
      {description}
    </span>
  );
}

function BenchmarkDeltaLabel({
  benchmarkValue,
  fundValue,
  higherIsBetter,
  unit
}: {
  benchmarkValue: number | null | undefined;
  fundValue: number | null | undefined;
  higherIsBetter: boolean;
  unit: "decimal" | "percent";
}) {
  const delta = getBenchmarkDelta({
    benchmarkValue,
    fundValue,
    higherIsBetter,
    unit
  });

  return (
    <span className={cn("whitespace-nowrap font-medium", getDeltaToneClassName(delta.tone))}>
      {delta.label}
    </span>
  );
}

function getBenchmarkDelta({
  benchmarkValue,
  fundValue,
  higherIsBetter,
  unit
}: {
  benchmarkValue: number | null | undefined;
  fundValue: number | null | undefined;
  higherIsBetter: boolean;
  unit: "decimal" | "percent";
}): {
  label: string;
  tone: "favorable" | "neutral" | "unfavorable";
} {
  if (!isFiniteNumber(fundValue) || !isFiniteNumber(benchmarkValue)) {
    return {
      label: "-",
      tone: "neutral"
    };
  }

  const rawDelta = fundValue - benchmarkValue;
  let tone: "favorable" | "neutral" | "unfavorable" = "neutral";

  if (rawDelta !== 0) {
    tone = (rawDelta > 0) === higherIsBetter ? "favorable" : "unfavorable";
  }

  return {
    label: formatSignedDelta(rawDelta, unit),
    tone
  };
}

function formatSignedDelta(delta: number, unit: "decimal" | "percent"): string {
  const sign = delta > 0 ? "+" : delta < 0 ? "-" : "";
  const value = Math.abs(delta).toFixed(unit === "percent" ? 1 : 2);

  return unit === "percent" ? `${sign}${value}%` : `${sign}${value}`;
}

function getDeltaToneClassName(tone: "favorable" | "neutral" | "unfavorable"): string {
  if (tone === "favorable") {
    return "text-emerald-600";
  }

  if (tone === "unfavorable") {
    return "text-destructive";
  }

  return "text-muted-foreground";
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getBenchmarkKey(category: FundCategory, planType: PlanType): string {
  return `${category}:${planType}`;
}
