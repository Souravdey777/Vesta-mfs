import { normalizeFilterState, normalizeSavedFilterName } from "@/lib/filters";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import type {
  FilterState,
  SavedFilterRecord,
  SavedFilterRow,
  SavedFilters,
  SavedFiltersSource
} from "@/lib/types";

export const SAVED_FILTERS_STORAGE_KEY = "mfscreener.saved_filters";

export type SavedFiltersUser = {
  id: string;
};

export type SupabaseLike = {
  auth?: {
    getUser(): Promise<{
      data?: {
        user?: SavedFiltersUser | null;
      };
      error?: {
        message: string;
      } | null;
    }>;
  };
  from(table: string): unknown;
};

export type BrowserStorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type SavedFiltersPersistenceOptions = {
  supabase?: SupabaseLike;
  storage?: BrowserStorageLike;
};

export type HydrateSavedFiltersResult = {
  source: SavedFiltersSource;
  savedFilters: SavedFilters;
};

export type SaveSavedFilterResult =
  | {
      status: "saved";
      source: SavedFiltersSource;
      name: string;
      savedFilters: SavedFilters;
    }
  | {
      status: "overwrite_required";
      source: SavedFiltersSource;
      name: string;
      savedFilters: SavedFilters;
    }
  | {
      status: "invalid_name";
      source: SavedFiltersSource;
      savedFilters: SavedFilters;
    };

export type LoadSavedFilterResult =
  | {
      status: "loaded";
      source: SavedFiltersSource;
      name: string;
      filters: FilterState;
      savedFilters: SavedFilters;
    }
  | {
      status: "not_found";
      source: SavedFiltersSource;
      name: string;
      availableNames: string[];
      savedFilters: SavedFilters;
    }
  | {
      status: "invalid_name";
      source: SavedFiltersSource;
      savedFilters: SavedFilters;
    };

export type DeleteSavedFilterResult =
  | {
      status: "deleted";
      source: SavedFiltersSource;
      name: string;
      savedFilters: SavedFilters;
    }
  | {
      status: "not_found";
      source: SavedFiltersSource;
      name: string;
      availableNames: string[];
      savedFilters: SavedFilters;
    }
  | {
      status: "invalid_name";
      source: SavedFiltersSource;
      savedFilters: SavedFilters;
    };

type SavedFiltersTable = {
  select(columns: string): {
    eq(column: string, value: string): {
      order(
        column: string,
        options?: { ascending?: boolean }
      ): Promise<{ data: SavedFilterRow[] | null; error: { message: string } | null }>;
    };
  };
  upsert(
    row: {
      user_id: string;
      name: string;
      filters: FilterState;
    },
    options: { onConflict: string }
  ): {
    select(columns: string): {
      single(): Promise<{ data: SavedFilterRow | null; error: { message: string } | null }>;
    };
  };
  delete(): {
    eq(column: string, value: string): {
      eq(column: string, value: string): Promise<{ data: null; error: { message: string } | null }>;
    };
  };
};

export async function hydrateSavedFilters(
  options: SavedFiltersPersistenceOptions = {}
): Promise<HydrateSavedFiltersResult> {
  const context = await resolveSavedFiltersContext(options);

  if (context.source === "supabase") {
    return {
      source: context.source,
      savedFilters: await readSupabaseSavedFilters(context.supabase, context.user.id)
    };
  }

  return {
    source: context.source,
    savedFilters: readLocalSavedFilters(context.storage)
  };
}

export async function saveSavedFilter({
  name,
  filters,
  overwrite = false,
  ...options
}: SavedFiltersPersistenceOptions & {
  name: string;
  filters: FilterState;
  overwrite?: boolean;
}): Promise<SaveSavedFilterResult> {
  const context = await resolveSavedFiltersContext(options);
  const normalizedName = normalizeSavedFilterName(name);

  if (!normalizedName) {
    return {
      status: "invalid_name",
      source: context.source,
      savedFilters: await readSavedFiltersForContext(context)
    };
  }

  const savedFilters = await readSavedFiltersForContext(context);

  if (savedFilters[normalizedName] && !overwrite) {
    return {
      status: "overwrite_required",
      source: context.source,
      name: normalizedName,
      savedFilters
    };
  }

  const normalizedFilters = normalizeFilterState(filters);
  const updatedSavedFilters =
    context.source === "supabase"
      ? await writeSupabaseSavedFilter(context.supabase, context.user.id, normalizedName, normalizedFilters)
      : writeLocalSavedFilter(context.storage, savedFilters, normalizedName, normalizedFilters);

  return {
    status: "saved",
    source: context.source,
    name: normalizedName,
    savedFilters: updatedSavedFilters
  };
}

export async function loadSavedFilter({
  name,
  ...options
}: SavedFiltersPersistenceOptions & {
  name: string;
}): Promise<LoadSavedFilterResult> {
  const context = await resolveSavedFiltersContext(options);
  const normalizedName = normalizeSavedFilterName(name);
  const savedFilters = await readSavedFiltersForContext(context);

  if (!normalizedName) {
    return {
      status: "invalid_name",
      source: context.source,
      savedFilters
    };
  }

  const savedFilter = savedFilters[normalizedName];

  if (!savedFilter) {
    return {
      status: "not_found",
      source: context.source,
      name: normalizedName,
      availableNames: Object.keys(savedFilters),
      savedFilters
    };
  }

  return {
    status: "loaded",
    source: context.source,
    name: normalizedName,
    filters: savedFilter.filters,
    savedFilters
  };
}

export async function deleteSavedFilter({
  name,
  ...options
}: SavedFiltersPersistenceOptions & {
  name: string;
}): Promise<DeleteSavedFilterResult> {
  const context = await resolveSavedFiltersContext(options);
  const normalizedName = normalizeSavedFilterName(name);
  const savedFilters = await readSavedFiltersForContext(context);

  if (!normalizedName) {
    return {
      status: "invalid_name",
      source: context.source,
      savedFilters
    };
  }

  if (!savedFilters[normalizedName]) {
    return {
      status: "not_found",
      source: context.source,
      name: normalizedName,
      availableNames: Object.keys(savedFilters),
      savedFilters
    };
  }

  const updatedSavedFilters =
    context.source === "supabase"
      ? await deleteSupabaseSavedFilter(context.supabase, context.user.id, normalizedName)
      : deleteLocalSavedFilter(context.storage, savedFilters, normalizedName);

  return {
    status: "deleted",
    source: context.source,
    name: normalizedName,
    savedFilters: updatedSavedFilters
  };
}

export async function listSavedFilterNames(
  options: SavedFiltersPersistenceOptions = {}
): Promise<{ source: SavedFiltersSource; names: string[]; savedFilters: SavedFilters }> {
  const hydrated = await hydrateSavedFilters(options);

  return {
    source: hydrated.source,
    names: Object.keys(hydrated.savedFilters),
    savedFilters: hydrated.savedFilters
  };
}

function readLocalSavedFilters(storage = getBrowserStorage()): SavedFilters {
  if (!storage) {
    return {};
  }

  const rawValue = storage.getItem(SAVED_FILTERS_STORAGE_KEY);

  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue);
    const normalized = normalizeSavedFiltersObject(parsed);
    storage.setItem(SAVED_FILTERS_STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  } catch {
    storage.setItem(SAVED_FILTERS_STORAGE_KEY, JSON.stringify({}));
    return {};
  }
}

function writeLocalSavedFilter(
  storage: BrowserStorageLike | undefined,
  savedFilters: SavedFilters,
  normalizedName: string,
  filters: FilterState
): SavedFilters {
  const now = new Date().toISOString();
  const next: SavedFilters = {
    ...savedFilters,
    [normalizedName]: {
      filters,
      created_at: savedFilters[normalizedName]?.created_at ?? now,
      updated_at: now
    }
  };

  storage?.setItem(SAVED_FILTERS_STORAGE_KEY, JSON.stringify(next));
  return next;
}

function deleteLocalSavedFilter(
  storage: BrowserStorageLike | undefined,
  savedFilters: SavedFilters,
  normalizedName: string
): SavedFilters {
  const next = { ...savedFilters };
  delete next[normalizedName];
  storage?.setItem(SAVED_FILTERS_STORAGE_KEY, JSON.stringify(next));
  return next;
}

async function readSupabaseSavedFilters(supabase: SupabaseLike, userId: string): Promise<SavedFilters> {
  const table = supabase.from("saved_filters") as SavedFiltersTable;
  const { data, error } = await table
    .select("id,user_id,name,normalized_name,filters,created_at,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to hydrate saved filters: ${error.message}`);
  }

  return normalizeSavedFilterRows(data ?? []);
}

async function writeSupabaseSavedFilter(
  supabase: SupabaseLike,
  userId: string,
  normalizedName: string,
  filters: FilterState
): Promise<SavedFilters> {
  const table = supabase.from("saved_filters") as SavedFiltersTable;
  const { error } = await table
    .upsert(
      {
        user_id: userId,
        name: normalizedName,
        filters
      },
      { onConflict: "user_id,normalized_name" }
    )
    .select("id,user_id,name,normalized_name,filters,created_at,updated_at")
    .single();

  if (error) {
    throw new Error(`Failed to save filter: ${error.message}`);
  }

  return readSupabaseSavedFilters(supabase, userId);
}

async function deleteSupabaseSavedFilter(
  supabase: SupabaseLike,
  userId: string,
  normalizedName: string
): Promise<SavedFilters> {
  const table = supabase.from("saved_filters") as SavedFiltersTable;
  const { error } = await table.delete().eq("user_id", userId).eq("normalized_name", normalizedName);

  if (error) {
    throw new Error(`Failed to delete filter: ${error.message}`);
  }

  return readSupabaseSavedFilters(supabase, userId);
}

async function resolveSavedFiltersContext(options: SavedFiltersPersistenceOptions): Promise<
  | {
      source: "supabase";
      supabase: SupabaseLike;
      user: SavedFiltersUser;
      storage?: BrowserStorageLike;
    }
  | {
      source: "localStorage";
      storage?: BrowserStorageLike;
    }
> {
  const supabase = options.supabase ?? getOptionalBrowserSupabaseClient();
  const user = await getSupabaseUser(supabase);

  if (supabase && user) {
    return {
      source: "supabase",
      supabase,
      user,
      storage: options.storage
    };
  }

  return {
    source: "localStorage",
    storage: options.storage ?? getBrowserStorage()
  };
}

async function getSupabaseUser(supabase?: SupabaseLike): Promise<SavedFiltersUser | null> {
  if (!supabase?.auth) {
    return null;
  }

  const { data, error } = await supabase.auth.getUser();

  if (error) {
    return null;
  }

  return data?.user ?? null;
}

async function readSavedFiltersForContext(
  context:
    | { source: "supabase"; supabase: SupabaseLike; user: SavedFiltersUser }
    | { source: "localStorage"; storage?: BrowserStorageLike }
): Promise<SavedFilters> {
  if (context.source === "supabase") {
    return readSupabaseSavedFilters(context.supabase, context.user.id);
  }

  return readLocalSavedFilters(context.storage);
}

function normalizeSavedFiltersObject(value: unknown): SavedFilters {
  if (!isPlainObject(value)) {
    return {};
  }

  const normalized: SavedFilters = {};

  for (const [name, record] of Object.entries(value)) {
    if (!isPlainObject(record)) {
      continue;
    }

    const normalizedName = normalizeSavedFilterName(name);
    const filters = normalizeFilterState(
      isPlainObject(record.filters) ? (record.filters as Partial<FilterState>) : {}
    );
    const createdAt = typeof record.created_at === "string" ? record.created_at : new Date().toISOString();
    const updatedAt = typeof record.updated_at === "string" ? record.updated_at : createdAt;

    if (normalizedName) {
      normalized[normalizedName] = {
        filters,
        created_at: createdAt,
        updated_at: updatedAt
      };
    }
  }

  return normalized;
}

function normalizeSavedFilterRows(rows: SavedFilterRow[]): SavedFilters {
  const normalized: SavedFilters = {};

  for (const row of rows) {
    const normalizedName = normalizeSavedFilterName(row.normalized_name || row.name);

    if (!normalizedName) {
      continue;
    }

    normalized[normalizedName] = {
      filters: normalizeFilterState(row.filters),
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  return normalized;
}

function getOptionalBrowserSupabaseClient(): SupabaseLike | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    return createBrowserSupabaseClient() as SupabaseLike;
  } catch {
    return undefined;
  }
}

function getBrowserStorage(): BrowserStorageLike | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.localStorage;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
