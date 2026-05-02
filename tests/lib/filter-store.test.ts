import { beforeEach, describe, expect, it } from "vitest";

import { saveSavedFilter, type SupabaseLike } from "@/lib/saved-filters";
import { resetFiltersStoreForTests, useFiltersStore } from "@/lib/store/filters";
import type { FilterState, SavedFilterRow } from "@/lib/types";

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

  it("deletes saved filters and tracks sync conflicts through the single store", async () => {
    const mock = createMockSupabase([
      {
        id: "row-1",
        user_id: "user-1",
        name: "retirement",
        normalized_name: "retirement",
        filters: { category: "Debt" },
        created_at: "2026-05-01T00:00:00.000Z",
        updated_at: "2026-05-01T00:00:00.000Z"
      }
    ]);
    await saveSavedFilter({
      storage: window.localStorage,
      name: "retirement",
      filters: { category: "Large Cap" }
    });

    const conflict = await useFiltersStore.getState().syncAnonymousSavedFilters({
      supabase: mock.client,
      storage: window.localStorage
    });

    expect(conflict.status).toBe("conflicts");
    expect(useFiltersStore.getState().savedFiltersSyncStatus).toBe("conflicts");
    expect(useFiltersStore.getState().savedFiltersSyncConflicts).toHaveLength(1);

    const resolved = await useFiltersStore.getState().syncAnonymousSavedFilters({
      supabase: mock.client,
      storage: window.localStorage,
      conflictResolutions: [
        {
          name: "retirement",
          action: "keep_supabase"
        }
      ]
    });

    expect(resolved.status).toBe("synced");
    expect(useFiltersStore.getState().savedFiltersSyncStatus).toBe("synced");
    expect(useFiltersStore.getState().savedFiltersSyncConflicts).toEqual([]);

    const deleted = await useFiltersStore.getState().deleteSavedFilter("retirement", {
      supabase: mock.client
    });

    expect(deleted.status).toBe("deleted");
    expect(useFiltersStore.getState().savedFilters).toEqual({});
  });
});

function createMockSupabase(initialRows: SavedFilterRow[]) {
  let rows = [...initialRows];

  const client: SupabaseLike = {
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: "user-1"
          }
        },
        error: null
      })
    },
    from: () => ({
      select: () => ({
        eq: (_column: string, value: string) => ({
          order: async () => ({
            data: rows.filter((row) => row.user_id === value),
            error: null
          })
        })
      }),
      upsert: (
        row: {
          user_id: string;
          name: string;
          filters: FilterState;
        },
        _options: { onConflict: string }
      ) => ({
        select: () => ({
          single: async () => {
            const normalizedName = row.name.trim().toLowerCase();
            const now = new Date().toISOString();
            const existing = rows.find(
              (savedRow) =>
                savedRow.user_id === row.user_id && savedRow.normalized_name === normalizedName
            );
            const nextRow: SavedFilterRow = {
              id: existing?.id ?? `row-${rows.length + 1}`,
              user_id: row.user_id,
              name: normalizedName,
              normalized_name: normalizedName,
              filters: row.filters,
              created_at: existing?.created_at ?? now,
              updated_at: now
            };

            rows = [
              ...rows.filter(
                (savedRow) =>
                  savedRow.user_id !== row.user_id || savedRow.normalized_name !== normalizedName
              ),
              nextRow
            ];

            return {
              data: nextRow,
              error: null
            };
          }
        })
      }),
      delete: () => ({
        eq: (firstColumn: string, firstValue: string) => ({
          eq: async (secondColumn: string, secondValue: string) => {
            rows = rows.filter(
              (row) =>
                row[firstColumn as keyof SavedFilterRow] !== firstValue ||
                row[secondColumn as keyof SavedFilterRow] !== secondValue
            );

            return {
              data: null,
              error: null
            };
          }
        })
      })
    })
  };

  return {
    client
  };
}
