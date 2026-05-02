"use client";

import { create } from "zustand";

import {
  applyFilters as applyFiltersToState,
  clearFilters as clearFilterState,
  normalizeFilterState,
  removeFilter as removeFilterFromState
} from "@/lib/filters";
import {
  deleteSavedFilter,
  hydrateSavedFilters,
  listSavedFilterNames,
  loadSavedFilter,
  saveSavedFilter,
  type DeleteSavedFilterResult,
  type HydrateSavedFiltersResult,
  type LoadSavedFilterResult,
  type SaveSavedFilterResult,
  type SavedFiltersPersistenceOptions
} from "@/lib/saved-filters";
import type {
  ApplyFiltersInput,
  FilterKey,
  FilterState,
  SavedFilters,
  SavedFiltersSource,
  SavedFiltersStatus
} from "@/lib/types";

export type FiltersStore = {
  filters: FilterState;
  savedFilters: SavedFilters;
  savedFiltersStatus: SavedFiltersStatus;
  savedFiltersSource: SavedFiltersSource;
  savedFiltersError: string | null;
  applyFilters: (input: ApplyFiltersInput) => void;
  clearFilters: () => void;
  removeFilter: (key: FilterKey) => void;
  setFilters: (filters: FilterState) => void;
  hydrateSavedFilters: (options?: SavedFiltersPersistenceOptions) => Promise<HydrateSavedFiltersResult>;
  saveCurrentFilter: (
    name: string,
    options?: SavedFiltersPersistenceOptions & { overwrite?: boolean }
  ) => Promise<SaveSavedFilterResult>;
  loadSavedFilter: (
    name: string,
    options?: SavedFiltersPersistenceOptions
  ) => Promise<LoadSavedFilterResult>;
  deleteSavedFilter: (
    name: string,
    options?: SavedFiltersPersistenceOptions
  ) => Promise<DeleteSavedFilterResult>;
  listSavedFilterNames: (options?: SavedFiltersPersistenceOptions) => Promise<string[]>;
};

const initialState = {
  filters: {},
  savedFilters: {},
  savedFiltersStatus: "idle" as const,
  savedFiltersSource: "localStorage" as const,
  savedFiltersError: null
};

export const useFiltersStore = create<FiltersStore>((set, get) => ({
  ...initialState,
  applyFilters: (input) => {
    set((state) => ({
      filters: applyFiltersToState(state.filters, input)
    }));
  },
  clearFilters: () => {
    set({
      filters: clearFilterState()
    });
  },
  removeFilter: (key) => {
    set((state) => ({
      filters: removeFilterFromState(state.filters, key)
    }));
  },
  setFilters: (filters) => {
    set({
      filters: normalizeFilterState(filters)
    });
  },
  hydrateSavedFilters: async (options) => {
    set({
      savedFiltersStatus: "loading",
      savedFiltersError: null
    });

    try {
      const result = await hydrateSavedFilters(options);
      set({
        savedFilters: result.savedFilters,
        savedFiltersSource: result.source,
        savedFiltersStatus: "ready"
      });
      return result;
    } catch (error) {
      const message = getErrorMessage(error);
      set({
        savedFiltersStatus: "error",
        savedFiltersError: message
      });
      throw error;
    }
  },
  saveCurrentFilter: async (name, options = {}) => {
    const result = await saveSavedFilter({
      ...options,
      name,
      filters: get().filters,
      overwrite: options.overwrite ?? false
    });

    set({
      savedFilters: result.savedFilters,
      savedFiltersSource: result.source,
      savedFiltersStatus: "ready",
      savedFiltersError: null
    });

    return result;
  },
  loadSavedFilter: async (name, options) => {
    const result = await loadSavedFilter({
      ...options,
      name
    });

    set({
      savedFilters: result.savedFilters,
      savedFiltersSource: result.source,
      savedFiltersStatus: "ready",
      savedFiltersError: null,
      ...(result.status === "loaded" ? { filters: result.filters } : {})
    });

    return result;
  },
  deleteSavedFilter: async (name, options) => {
    const result = await deleteSavedFilter({
      ...options,
      name
    });

    set({
      savedFilters: result.savedFilters,
      savedFiltersSource: result.source,
      savedFiltersStatus: "ready",
      savedFiltersError: null
    });

    return result;
  },
  listSavedFilterNames: async (options) => {
    const result = await listSavedFilterNames(options);

    set({
      savedFilters: result.savedFilters,
      savedFiltersSource: result.source,
      savedFiltersStatus: "ready",
      savedFiltersError: null
    });

    return result.names;
  }
}));

export function resetFiltersStoreForTests() {
  useFiltersStore.setState(initialState);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown saved filters error.";
}
