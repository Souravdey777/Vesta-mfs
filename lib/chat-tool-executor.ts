"use client";

import { explainMetric } from "@/lib/chat-tools";
import type { SavedFiltersPersistenceOptions } from "@/lib/saved-filters";
import { useFiltersStore } from "@/lib/store/filters";
import type { ChatToolCall, FilterState, MetricName, SavedFiltersSource, ToolName } from "@/lib/types";

export type ChatToolExecutionResult =
  | {
      status: "filters_applied";
      name: Extract<ToolName, "apply_filters">;
      filters: FilterState;
    }
  | {
      status: "filters_cleared";
      name: Extract<ToolName, "clear_filters">;
      filters: FilterState;
    }
  | {
      status: "metric_explained";
      name: Extract<ToolName, "explain_metric">;
      metric: MetricName;
      message: string;
    }
  | {
      status: "saved" | "overwrite_required" | "invalid_name";
      name: Extract<ToolName, "save_filter">;
      savedName?: string;
      source: SavedFiltersSource;
    }
  | {
      status: "loaded" | "not_found" | "invalid_name";
      name: Extract<ToolName, "load_saved_filter">;
      savedName?: string;
      availableNames?: string[];
      source: SavedFiltersSource;
      filters?: FilterState;
    }
  | {
      status: "listed";
      name: Extract<ToolName, "list_saved_filters">;
      names: string[];
    };

export type ChatToolExecutorOptions = SavedFiltersPersistenceOptions & {
  overwrite?: boolean;
};

export async function executeChatToolCall(
  toolCall: ChatToolCall,
  options: ChatToolExecutorOptions = {}
): Promise<ChatToolExecutionResult> {
  const store = useFiltersStore.getState();

  switch (toolCall.name) {
    case "apply_filters": {
      store.applyFilters(toolCall.input);
      return {
        status: "filters_applied",
        name: toolCall.name,
        filters: useFiltersStore.getState().filters
      };
    }

    case "clear_filters": {
      store.clearFilters();
      return {
        status: "filters_cleared",
        name: toolCall.name,
        filters: useFiltersStore.getState().filters
      };
    }

    case "explain_metric": {
      return {
        status: "metric_explained",
        name: toolCall.name,
        metric: toolCall.input.metric,
        message: explainMetric(toolCall.input.metric, toolCall.input.context)
      };
    }

    case "save_filter": {
      const result = await store.saveCurrentFilter(toolCall.input.name, {
        storage: options.storage,
        supabase: options.supabase,
        overwrite: options.overwrite ?? false
      });

      return {
        status: result.status,
        name: toolCall.name,
        savedName: "name" in result ? result.name : undefined,
        source: result.source
      };
    }

    case "load_saved_filter": {
      const result = await store.loadSavedFilter(toolCall.input.name, {
        storage: options.storage,
        supabase: options.supabase
      });

      return {
        status: result.status,
        name: toolCall.name,
        savedName: "name" in result ? result.name : undefined,
        availableNames: "availableNames" in result ? result.availableNames : undefined,
        source: result.source,
        filters: "filters" in result ? result.filters : undefined
      };
    }

    case "list_saved_filters": {
      const names = await store.listSavedFilterNames({
        storage: options.storage,
        supabase: options.supabase
      });

      return {
        status: "listed",
        name: toolCall.name,
        names
      };
    }
  }
}
