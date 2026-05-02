"use client";

import * as React from "react";
import { ChevronDown, CloudUpload, Loader2, Save, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  listAnonymousSavedFilterNames,
  type BrowserStorageLike,
  type SavedFiltersSyncResolution,
  type SupabaseLike
} from "@/lib/saved-filters";
import { useFiltersStore } from "@/lib/store/filters";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

type SavedFiltersDropdownProps = {
  supabase?: SupabaseLike;
  storage?: BrowserStorageLike;
};

type ConflictChoice = {
  action: SavedFiltersSyncResolution["action"];
  renameTo: string;
};

export function SavedFiltersDropdown({ supabase: suppliedSupabase, storage: suppliedStorage }: SavedFiltersDropdownProps) {
  const [supabase] = React.useState<SupabaseLike | undefined>(
    () => suppliedSupabase ?? getOptionalSupabaseClient()
  );
  const [storage] = React.useState<BrowserStorageLike | undefined>(
    () => suppliedStorage ?? getBrowserStorage()
  );
  const filters = useFiltersStore((state) => state.filters);
  const savedFilters = useFiltersStore((state) => state.savedFilters);
  const savedFiltersStatus = useFiltersStore((state) => state.savedFiltersStatus);
  const savedFiltersSource = useFiltersStore((state) => state.savedFiltersSource);
  const savedFiltersError = useFiltersStore((state) => state.savedFiltersError);
  const hydrateSavedFilters = useFiltersStore((state) => state.hydrateSavedFilters);
  const saveCurrentFilter = useFiltersStore((state) => state.saveCurrentFilter);
  const loadSavedFilter = useFiltersStore((state) => state.loadSavedFilter);
  const deleteSavedFilter = useFiltersStore((state) => state.deleteSavedFilter);
  const syncAnonymousSavedFilters = useFiltersStore((state) => state.syncAnonymousSavedFilters);
  const [open, setOpen] = React.useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = React.useState(false);
  const [overwriteName, setOverwriteName] = React.useState<string | null>(null);
  const [deleteName, setDeleteName] = React.useState<string | null>(null);
  const [saveName, setSaveName] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [isBusy, setIsBusy] = React.useState(false);
  const [anonymousNames, setAnonymousNames] = React.useState<string[]>([]);
  const [conflictDialogOpen, setConflictDialogOpen] = React.useState(false);
  const [conflictChoices, setConflictChoices] = React.useState<Record<string, ConflictChoice>>({});

  const savedNames = React.useMemo(() => Object.keys(savedFilters), [savedFilters]);
  const hasActiveFilters = React.useMemo(() => Object.keys(filters).length > 0, [filters]);
  const persistenceOptions = React.useMemo(
    () => ({
      supabase,
      storage
    }),
    [storage, supabase]
  );
  const showSyncPrompt = savedFiltersSource === "supabase" && anonymousNames.length > 0;

  const refreshAnonymousNames = React.useCallback(() => {
    setAnonymousNames(listAnonymousSavedFilterNames(storage));
  }, [storage]);

  const refreshSavedFilters = React.useCallback(async () => {
    await hydrateSavedFilters(persistenceOptions);
    refreshAnonymousNames();
  }, [hydrateSavedFilters, persistenceOptions, refreshAnonymousNames]);

  React.useEffect(() => {
    void refreshSavedFilters();

    const listener = supabase?.auth?.onAuthStateChange?.(() => {
      void refreshSavedFilters();
    });

    return () => {
      listener?.data?.subscription?.unsubscribe();
    };
  }, [refreshSavedFilters, supabase]);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setMessage(null);

    if (!saveName.trim()) {
      setFormError("Enter a name for this screen.");
      return;
    }

    setIsBusy(true);

    try {
      const result = await saveCurrentFilter(saveName, persistenceOptions);

      if (result.status === "invalid_name") {
        setFormError("Enter a name for this screen.");
        return;
      }

      if (result.status === "overwrite_required") {
        setOverwriteName(result.name);
        setSaveDialogOpen(false);
        return;
      }

      setSaveDialogOpen(false);
      setSaveName("");
      setMessage(`Saved ${result.name}.`);
    } catch {
      setFormError("Could not save this screen.");
    } finally {
      setIsBusy(false);
      refreshAnonymousNames();
    }
  }

  async function confirmOverwrite() {
    if (!overwriteName) {
      return;
    }

    setIsBusy(true);

    try {
      const result = await saveCurrentFilter(overwriteName, {
        ...persistenceOptions,
        overwrite: true
      });

      if (result.status === "saved") {
        setMessage(`Updated ${result.name}.`);
        setSaveName("");
      }
    } catch {
      setMessage("Could not overwrite this screen.");
    } finally {
      setIsBusy(false);
      setOverwriteName(null);
      refreshAnonymousNames();
    }
  }

  async function handleLoad(name: string) {
    setIsBusy(true);
    setMessage(null);

    try {
      const result = await loadSavedFilter(name, persistenceOptions);

      if (result.status === "loaded") {
        setOpen(false);
        setMessage(`Loaded ${result.name}.`);
      } else if (result.status === "not_found") {
        setMessage("That saved screen is no longer available.");
      }
    } catch {
      setMessage("Could not load this screen.");
    } finally {
      setIsBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteName) {
      return;
    }

    setIsBusy(true);

    try {
      const result = await deleteSavedFilter(deleteName, persistenceOptions);

      if (result.status === "deleted") {
        setMessage(`Deleted ${result.name}.`);
      }
    } catch {
      setMessage("Could not delete this screen.");
    } finally {
      setIsBusy(false);
      setDeleteName(null);
      refreshAnonymousNames();
    }
  }

  async function handleSync() {
    setIsBusy(true);
    setMessage(null);

    try {
      const result = await syncAnonymousSavedFilters(persistenceOptions);
      refreshAnonymousNames();

      if (result.status === "pending") {
        setMessage("Sign in to sync local screens.");
        return;
      }

      if (result.status === "conflicts") {
        setConflictChoices(
          Object.fromEntries(
            result.conflicts.map((conflict) => [
              conflict.name,
              {
                action: "keep_supabase" as const,
                renameTo: `${conflict.name} local`
              }
            ])
          )
        );
        setConflictDialogOpen(true);
        setMessage(
          result.importedNames.length > 0
            ? `Synced ${result.importedNames.length} screen${result.importedNames.length === 1 ? "" : "s"}.`
            : null
        );
        return;
      }

      setMessage(
        result.importedNames.length + result.overwrittenNames.length + result.renamedNames.length > 0
          ? "Local screens synced."
          : "No local screens to sync."
      );
    } catch {
      setMessage("Could not sync local screens.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleResolveConflicts(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);

    try {
      const conflictResolutions = Object.entries(conflictChoices).map(([name, choice]) => ({
        name,
        action: choice.action,
        renameTo: choice.action === "rename_local" ? choice.renameTo : undefined
      }));
      const result = await syncAnonymousSavedFilters({
        ...persistenceOptions,
        conflictResolutions
      });

      refreshAnonymousNames();

      if (result.status === "conflicts") {
        setConflictChoices(
          Object.fromEntries(
            result.conflicts.map((conflict) => [
              conflict.name,
              {
                action: "keep_supabase" as const,
                renameTo: `${conflict.name} local`
              }
            ])
          )
        );
        return;
      }

      setConflictDialogOpen(false);
      setMessage("Sync conflicts resolved.");
    } catch {
      setMessage("Could not resolve sync conflicts.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="secondary">
            <Save className="h-4 w-4" aria-hidden="true" />
            Saved filters
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel className="flex items-center justify-between gap-3">
            <span>Saved screens</span>
            <span className="rounded-sm bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {savedFiltersSource === "supabase" ? "Supabase" : "Anonymous"}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {hasActiveFilters ? (
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                setSaveDialogOpen(true);
                setFormError(null);
              }}
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              Save current view
            </DropdownMenuItem>
          ) : null}

          {showSyncPrompt ? (
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                void handleSync();
              }}
            >
              {isBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <CloudUpload className="h-4 w-4" aria-hidden="true" />
              )}
              Sync {anonymousNames.length} local screen{anonymousNames.length === 1 ? "" : "s"}
            </DropdownMenuItem>
          ) : null}

          {hasActiveFilters || showSyncPrompt ? <DropdownMenuSeparator /> : null}

          {savedFiltersStatus === "loading" ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">Loading saved screens...</p>
          ) : null}

          {savedFiltersStatus !== "loading" && savedNames.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              Save filters and reload them from chat or this menu.
            </p>
          ) : null}

          {savedNames.length > 0 ? (
            <div className="max-h-64 overflow-y-auto">
              {savedNames.map((name) => (
                <div className="flex items-center gap-1 rounded-sm px-1 py-1" key={name}>
                  <button
                    className="min-w-0 flex-1 rounded-sm px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-accent focus:bg-accent"
                    disabled={isBusy}
                    onClick={() => void handleLoad(name)}
                    type="button"
                  >
                    <span className="block truncate">{name}</span>
                  </button>
                  <button
                    aria-label={`Delete ${name}`}
                    className="rounded-sm p-1.5 text-muted-foreground outline-none transition-colors hover:bg-destructive hover:text-destructive-foreground focus:bg-destructive focus:text-destructive-foreground"
                    disabled={isBusy}
                    onClick={() => setDeleteName(name)}
                    type="button"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {savedFiltersError || message ? (
            <>
              <DropdownMenuSeparator />
              <p
                className={cn(
                  "px-2 py-1 text-xs",
                  savedFiltersError ? "text-destructive" : "text-muted-foreground"
                )}
              >
                {savedFiltersError ?? message}
              </p>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save current view</DialogTitle>
            <DialogDescription>Name this filter set so you can load it later.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={(event) => void handleSave(event)}>
            <div className="grid gap-2">
              <Label htmlFor="saved-filter-name">Name</Label>
              <Input
                autoComplete="off"
                id="saved-filter-name"
                onChange={(event) => setSaveName(event.target.value)}
                placeholder="large cap high growth"
                value={saveName}
              />
              {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSaveDialogOpen(false);
                  setFormError(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isBusy}>
                {isBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(overwriteName)} onOpenChange={(nextOpen) => !nextOpen && setOverwriteName(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Overwrite saved screen?</AlertDialogTitle>
            <AlertDialogDescription>
              A saved screen named {overwriteName} already exists. Overwriting replaces its filters.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isBusy} onClick={() => void confirmOverwrite()}>
              Overwrite
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(deleteName)} onOpenChange={(nextOpen) => !nextOpen && setDeleteName(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete saved screen?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteName} will be removed from {savedFiltersSource === "supabase" ? "Supabase" : "this browser"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isBusy}
              onClick={() => void confirmDelete()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={conflictDialogOpen} onOpenChange={setConflictDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve sync conflicts</DialogTitle>
            <DialogDescription>
              Choose what to do with local screens that share names with Supabase screens.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={(event) => void handleResolveConflicts(event)}>
            {Object.entries(conflictChoices).map(([name, choice]) => (
              <div className="grid gap-3 rounded-md border border-border p-3" key={name}>
                <Label htmlFor={`conflict-${name}`}>{name}</Label>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  id={`conflict-${name}`}
                  onChange={(event) =>
                    setConflictChoices((current) => ({
                      ...current,
                      [name]: {
                        ...current[name],
                        action: event.target.value as SavedFiltersSyncResolution["action"]
                      }
                    }))
                  }
                  value={choice.action}
                >
                  <option value="keep_supabase">Keep Supabase</option>
                  <option value="overwrite_supabase">Overwrite Supabase</option>
                  <option value="rename_local">Keep both</option>
                </select>
                {choice.action === "rename_local" ? (
                  <Input
                    aria-label={`Rename ${name}`}
                    onChange={(event) =>
                      setConflictChoices((current) => ({
                        ...current,
                        [name]: {
                          ...current[name],
                          renameTo: event.target.value
                        }
                      }))
                    }
                    value={choice.renameTo}
                  />
                ) : null}
              </div>
            ))}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConflictDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isBusy}>
                Resolve
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function getOptionalSupabaseClient(): SupabaseLike | undefined {
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
