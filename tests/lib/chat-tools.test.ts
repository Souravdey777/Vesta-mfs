import { describe, expect, it } from "vitest";

import { CHAT_TOOL_DEFINITIONS, parseChatToolCall } from "@/lib/chat-tools";
import { MF_SCREENER_SYSTEM_PROMPT } from "@/lib/prompts";
import { FILTER_CATEGORIES, METRIC_NAMES, PLAN_TYPES, SORT_FIELDS, SORT_ORDERS } from "@/lib/types";

describe("chat prompt and tool definitions", () => {
  it("contains the canonical safety and UX rules", () => {
    expect(MF_SCREENER_SYSTEM_PROMPT).toContain("Never name specific funds");
    expect(MF_SCREENER_SYSTEM_PROMPT).toContain("translate it into apply_filters");
    expect(MF_SCREENER_SYSTEM_PROMPT).toContain("Be brief. Two to four sentences");
    expect(MF_SCREENER_SYSTEM_PROMPT).toContain("Do not give tax or investment advice");
  });

  it("defines exactly the canonical six tools with shared enum values", () => {
    expect(CHAT_TOOL_DEFINITIONS.map((tool) => tool.name)).toEqual([
      "apply_filters",
      "clear_filters",
      "explain_metric",
      "save_filter",
      "load_saved_filter",
      "list_saved_filters"
    ]);

    const applyFilters = CHAT_TOOL_DEFINITIONS.find((tool) => tool.name === "apply_filters");
    const explainMetric = CHAT_TOOL_DEFINITIONS.find((tool) => tool.name === "explain_metric");

    expect(applyFilters?.input_schema.properties.category).toMatchObject({
      enum: FILTER_CATEGORIES
    });
    expect(applyFilters?.input_schema.properties.plan_type).toMatchObject({
      enum: PLAN_TYPES
    });
    expect(applyFilters?.input_schema.properties.sort_by).toMatchObject({
      enum: SORT_FIELDS
    });
    expect(applyFilters?.input_schema.properties.order).toMatchObject({
      enum: SORT_ORDERS
    });
    expect(explainMetric?.input_schema.properties.metric).toMatchObject({
      enum: METRIC_NAMES
    });
  });

  it("validates typed tool calls", () => {
    expect(
      parseChatToolCall("toolu_1", "apply_filters", {
        category: "Large Cap",
        min_returns_3y: 15,
        sort_by: "returns_3y"
      })
    ).toMatchObject({
      ok: true,
      toolCall: {
        id: "toolu_1",
        name: "apply_filters",
        input: {
          category: "Large Cap",
          min_returns_3y: 15,
          sort_by: "returns_3y"
        }
      }
    });

    expect(parseChatToolCall("toolu_2", "bad_tool", {})).toEqual({
      ok: false,
      error: "Invalid tool call."
    });
    expect(parseChatToolCall("toolu_3", "apply_filters", { category: "Liquid" })).toEqual({
      ok: false,
      error: "Invalid tool input."
    });
  });
});
