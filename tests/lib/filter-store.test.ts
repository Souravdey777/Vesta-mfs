import { beforeEach, describe, expect, it } from "vitest";

import { resetFiltersStoreForTests, useFiltersStore } from "@/lib/store/filters";

describe("filters store", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetFiltersStoreForTests();
  });

  it("applies, saves, loads, and removes filters through the single Zustand store", async () => {
    const store = useFiltersStore.getState();

    store.applyFilters({
      category: "Large Cap",
      min_returns_3y: 15,
      sort_by: "returns_3y"
    });

    expect(useFiltersStore.getState().filters).toEqual({
      category: "Large Cap",
      min_returns_3y: 15,
      sort_by: "returns_3y",
      order: "desc"
    });

    const saved = await useFiltersStore.getState().saveCurrentFilter("large cap high growth", {
      storage: window.localStorage
    });

    expect(saved.status).toBe("saved");
    expect(useFiltersStore.getState().savedFiltersStatus).toBe("ready");

    useFiltersStore.getState().clearFilters();
    expect(useFiltersStore.getState().filters).toEqual({});

    const loaded = await useFiltersStore.getState().loadSavedFilter("large cap high growth", {
      storage: window.localStorage
    });

    expect(loaded.status).toBe("loaded");
    expect(useFiltersStore.getState().filters).toEqual({
      category: "Large Cap",
      min_returns_3y: 15,
      sort_by: "returns_3y",
      order: "desc"
    });

    useFiltersStore.getState().removeFilter("sort_by");
    expect(useFiltersStore.getState().filters).toEqual({
      category: "Large Cap",
      min_returns_3y: 15
    });
  });
});
