import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { SavedFiltersDropdown } from "@/components/saved-filters-dropdown";
import { saveSavedFilter, type SupabaseLike } from "@/lib/saved-filters";
import { resetFiltersStoreForTests, useFiltersStore } from "@/lib/store/filters";
import type { FilterState, SavedFilterRow } from "@/lib/types";

describe("SavedFiltersDropdown", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetFiltersStoreForTests();
  });

  it("lists saved filters and loads a selected screen", async () => {
    await saveSavedFilter({
      storage: window.localStorage,
      name: "tax saving",
      filters: { category: "ELSS" }
    });

    render(<SavedFiltersDropdown storage={window.localStorage} />);
    await waitFor(() => expect(useFiltersStore.getState().savedFilters).toHaveProperty("tax saving"));

    openSavedFiltersMenu();
    fireEvent.click(await screen.findByText("tax saving"));

    await waitFor(() =>
      expect(useFiltersStore.getState().filters).toEqual({
        category: "ELSS"
      })
    );
  });

  it("prompts before overwriting duplicate names", async () => {
    await saveSavedFilter({
      storage: window.localStorage,
      name: "tax saving",
      filters: { category: "Debt" }
    });
    useFiltersStore.getState().applyFilters({ category: "ELSS" });

    render(<SavedFiltersDropdown storage={window.localStorage} />);
    await waitFor(() => expect(useFiltersStore.getState().savedFilters).toHaveProperty("tax saving"));

    openSavedFiltersMenu();
    fireEvent.click(await screen.findByText("Save current view"));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: {
        value: "Tax Saving"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Overwrite saved screen?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Overwrite" }));

    await waitFor(() =>
      expect(useFiltersStore.getState().savedFilters["tax saving"]?.filters).toEqual({
        category: "ELSS"
      })
    );
  });

  it("confirms delete before removing a saved filter", async () => {
    await saveSavedFilter({
      storage: window.localStorage,
      name: "retirement",
      filters: { category: "Large Cap" }
    });

    render(<SavedFiltersDropdown storage={window.localStorage} />);
    await waitFor(() => expect(useFiltersStore.getState().savedFilters).toHaveProperty("retirement"));

    openSavedFiltersMenu();
    fireEvent.click(await screen.findByLabelText("Delete retirement"));

    expect(await screen.findByText("Delete saved screen?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(useFiltersStore.getState().savedFilters).toEqual({}));
  });

  it("shows a sync prompt when signed in with anonymous local saves", async () => {
    await saveSavedFilter({
      storage: window.localStorage,
      name: "local screen",
      filters: { category: "Index" }
    });
    const mock = createMockSupabase([]);

    render(<SavedFiltersDropdown storage={window.localStorage} supabase={mock.client} />);
    await waitFor(() => expect(useFiltersStore.getState().savedFiltersSource).toBe("supabase"));

    openSavedFiltersMenu();

    expect(await screen.findByText("Sync 1 local screen")).toBeInTheDocument();
  });
});

function openSavedFiltersMenu() {
  const trigger = screen.getByRole("button", { name: /saved filters/i });
  fireEvent.click(trigger);
  fireEvent.mouseDown(trigger);
  fireEvent.pointerDown(trigger, {
    button: 0,
    ctrlKey: false,
    pointerType: "mouse"
  });
  fireEvent.keyDown(trigger, {
    key: "ArrowDown"
  });
}

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
      }),
      onAuthStateChange: () => ({
        data: {
          subscription: {
            unsubscribe: () => {}
          }
        }
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
        eq: (_firstColumn: string, firstValue: string) => ({
          eq: async (_secondColumn: string, secondValue: string) => {
            rows = rows.filter(
              (row) => row.user_id !== firstValue || row.normalized_name !== secondValue
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
