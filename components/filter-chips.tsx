"use client";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getFilterChips } from "@/lib/filter-labels";
import type { FilterKey, FilterState } from "@/lib/types";

type FilterChipsProps = {
  filters: FilterState;
  onClearAll: () => void;
  onRemove: (key: FilterKey) => void;
};

export function FilterChips({ filters, onClearAll, onRemove }: FilterChipsProps) {
  const chips = getFilterChips(filters);

  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          className="inline-flex h-8 max-w-full items-center gap-1 rounded-md border border-border bg-background px-2 text-sm text-foreground transition-colors hover:bg-muted"
          key={`${chip.key}-${chip.label}`}
          onClick={() => onRemove(chip.key)}
          type="button"
        >
          <span className="truncate">{chip.label}</span>
          <X className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        </button>
      ))}
      <Button size="sm" variant="ghost" className="h-8 px-2" onClick={onClearAll}>
        Clear all
      </Button>
    </div>
  );
}
