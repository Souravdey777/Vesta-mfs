import { beforeEach, describe, expect, it } from "vitest";

import { executeChatToolCall } from "@/lib/chat-tool-executor";
import { resetFiltersStoreForTests, useFiltersStore } from "@/lib/store/filters";
import type { ChatToolCall } from "@/lib/types";

describe("chat tool executor", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetFiltersStoreForTests();
  });

  it("applies and clears filters through the single Zustand store", async () => {
    const applied = await executeChatToolCall(toolCall("apply_filters", {
      category: "Large Cap",
      min_returns_3y: 15,
      sort_by: "returns_3y"
    }));

    expect(applied).toMatchObject({
      status: "filters_applied",
      filters: {
        category: "Large Cap",
        min_returns_3y: 15,
        sort_by: "returns_3y",
        order: "desc"
      }
    });

    const cleared = await executeChatToolCall(toolCall("clear_filters", {}));
    expect(cleared).toEqual({
      status: "filters_cleared",
      name: "clear_filters",
      filters: {}
    });
  });

  it("explains metrics with deterministic local copy", async () => {
    const result = await executeChatToolCall(toolCall("explain_metric", {
      metric: "expense_ratio"
    }));

    expect(result).toMatchObject({
      status: "metric_explained",
      name: "explain_metric",
      metric: "expense_ratio"
    });
    expect(result.status === "metric_explained" ? result.message : "").toContain(
      "yearly fee"
    );
  });

  it("saves, detects duplicates, lists, loads, and reports missing saved filters", async () => {
    useFiltersStore.getState().applyFilters({
      category: "ELSS",
      min_rating: 4
    });

    const saved = await executeChatToolCall(toolCall("save_filter", { name: "Tax Saving" }), {
      storage: window.localStorage
    });
    expect(saved).toMatchObject({
      status: "saved",
      name: "save_filter",
      savedName: "tax saving",
      source: "localStorage"
    });

    const duplicate = await executeChatToolCall(toolCall("save_filter", { name: "tax saving" }), {
      storage: window.localStorage
    });
    expect(duplicate).toMatchObject({
      status: "overwrite_required",
      savedName: "tax saving"
    });

    const listed = await executeChatToolCall(toolCall("list_saved_filters", {}), {
      storage: window.localStorage
    });
    expect(listed).toEqual({
      status: "listed",
      name: "list_saved_filters",
      names: ["tax saving"]
    });

    useFiltersStore.getState().clearFilters();

    const loaded = await executeChatToolCall(toolCall("load_saved_filter", { name: "TAX SAVING" }), {
      storage: window.localStorage
    });
    expect(loaded).toMatchObject({
      status: "loaded",
      savedName: "tax saving",
      filters: {
        category: "ELSS",
        min_rating: 4
      }
    });
    expect(useFiltersStore.getState().filters).toEqual({
      category: "ELSS",
      min_rating: 4
    });

    const missing = await executeChatToolCall(toolCall("load_saved_filter", { name: "missing" }), {
      storage: window.localStorage
    });
    expect(missing).toMatchObject({
      status: "not_found",
      savedName: "missing",
      availableNames: ["tax saving"]
    });
  });
});

function toolCall<Name extends ChatToolCall["name"]>(
  name: Name,
  input: Extract<ChatToolCall, { name: Name }>["input"]
): Extract<ChatToolCall, { name: Name }> {
  return {
    id: `tool-${name}`,
    name,
    input
  } as Extract<ChatToolCall, { name: Name }>;
}
