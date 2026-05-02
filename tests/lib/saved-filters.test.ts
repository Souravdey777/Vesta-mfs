import { beforeEach, describe, expect, it } from "vitest";

import {
  deleteSavedFilter,
  hydrateSavedFilters,
  listSavedFilterNames,
  loadSavedFilter,
  saveSavedFilter,
  SAVED_FILTERS_STORAGE_KEY,
  type SupabaseLike
} from "@/lib/saved-filters";
import type { FilterState, SavedFilterRow } from "@/lib/types";

describe("saved filter persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("hydrates, saves, overwrites, loads, lists, and deletes anonymous localStorage filters", async () => {
    const saved = await saveSavedFilter({
      storage: window.localStorage,
      name: "Retirement",
      filters: { category: "Large Cap", min_returns_3y: 15 }
    });

    expect(saved.status).toBe("saved");
    expect(saved.source).toBe("localStorage");
    expect(saved.savedFilters.retirement?.filters).toEqual({
      category: "Large Cap",
      min_returns_3y: 15
    });

    const duplicate = await saveSavedFilter({
      storage: window.localStorage,
      name: " retirement ",
      filters: { category: "Debt" }
    });

    expect(duplicate.status).toBe("overwrite_required");

    const overwritten = await saveSavedFilter({
      storage: window.localStorage,
      name: "retirement",
      filters: { category: "Debt" },
      overwrite: true
    });

    expect(overwritten.savedFilters.retirement?.filters).toEqual({
      category: "Debt"
    });

    const loaded = await loadSavedFilter({
      storage: window.localStorage,
      name: "RETIREMENT"
    });

    expect(loaded.status).toBe("loaded");
    expect(loaded.status === "loaded" ? loaded.filters : null).toEqual({
      category: "Debt"
    });

    const listed = await listSavedFilterNames({ storage: window.localStorage });
    expect(listed.names).toEqual(["retirement"]);

    const deleted = await deleteSavedFilter({
      storage: window.localStorage,
      name: "retirement"
    });

    expect(deleted.status).toBe("deleted");
    expect(deleted.savedFilters).toEqual({});
  });

  it("returns not found for unknown saved filters", async () => {
    await saveSavedFilter({
      storage: window.localStorage,
      name: "tax saving",
      filters: { category: "ELSS" }
    });

    const loaded = await loadSavedFilter({
      storage: window.localStorage,
      name: "missing"
    });

    expect(loaded).toMatchObject({
      status: "not_found",
      name: "missing",
      availableNames: ["tax saving"]
    });
  });

  it("rejects empty saved filter names", async () => {
    const saved = await saveSavedFilter({
      storage: window.localStorage,
      name: "   ",
      filters: { category: "Index" }
    });

    expect(saved.status).toBe("invalid_name");
  });

  it("resets malformed localStorage data", async () => {
    window.localStorage.setItem(SAVED_FILTERS_STORAGE_KEY, "not-json");

    const hydrated = await hydrateSavedFilters({ storage: window.localStorage });

    expect(hydrated.savedFilters).toEqual({});
    expect(window.localStorage.getItem(SAVED_FILTERS_STORAGE_KEY)).toBe("{}");
  });

  it("uses Supabase when a user is authenticated", async () => {
    const mock = createMockSupabase([
      {
        id: "row-1",
        user_id: "user-1",
        name: "tax saving",
        normalized_name: "tax saving",
        filters: { category: "ELSS" },
        created_at: "2026-05-01T00:00:00.000Z",
        updated_at: "2026-05-01T00:00:00.000Z"
      }
    ]);

    const hydrated = await hydrateSavedFilters({ supabase: mock.client });
    expect(hydrated).toMatchObject({
      source: "supabase",
      savedFilters: {
        "tax saving": {
          filters: { category: "ELSS" }
        }
      }
    });

    const saved = await saveSavedFilter({
      supabase: mock.client,
      name: "High Growth",
      filters: { category: "Small Cap", min_rating: 5 }
    });

    expect(saved.status).toBe("saved");
    expect(saved.savedFilters["high growth"]?.filters).toEqual({
      category: "Small Cap",
      min_rating: 5
    });

    const deleted = await deleteSavedFilter({
      supabase: mock.client,
      name: "tax saving"
    });

    expect(deleted.status).toBe("deleted");
    expect(deleted.savedFilters["tax saving"]).toBeUndefined();
    expect(mock.calls).toContain("select:eq:user_id:user-1");
    expect(mock.calls).toContain("upsert:user-1:high growth");
    expect(mock.calls).toContain("delete:eq:user_id:user-1:eq:normalized_name:tax saving");
  });
});

function createMockSupabase(initialRows: SavedFilterRow[]) {
  let rows = [...initialRows];
  const calls: string[] = [];

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
    from: (tableName: string) => {
      calls.push(`from:${tableName}`);

      return {
        select: () => ({
          eq: (column: string, value: string) => ({
            order: async () => {
              calls.push(`select:eq:${column}:${value}`);

              return {
                data: rows.filter((row) => row.user_id === value),
                error: null
              };
            }
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
              calls.push(`upsert:${row.user_id}:${normalizedName}`);

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
                    savedRow.user_id !== row.user_id ||
                    savedRow.normalized_name !== normalizedName
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
              calls.push(
                `delete:eq:${firstColumn}:${firstValue}:eq:${secondColumn}:${secondValue}`
              );

              rows = rows.filter(
                (row) =>
                  row.user_id !== firstValue || row.normalized_name !== secondValue
              );

              return {
                data: null,
                error: null
              };
            }
          })
        })
      };
    }
  };

  return {
    client,
    calls
  };
}
