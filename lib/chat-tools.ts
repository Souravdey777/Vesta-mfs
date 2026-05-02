import { z } from "zod";

import {
  FILTER_CATEGORIES,
  METRIC_NAMES,
  PLAN_TYPES,
  RATINGS,
  SORT_FIELDS,
  SORT_ORDERS,
  type ChatToolCall,
  type MetricName,
  type ToolInputMap,
  type ToolName
} from "@/lib/types";

type JsonSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties: false;
};

export type ChatToolDefinition = {
  name: ToolName;
  description: string;
  input_schema: JsonSchema;
};

const noArgsSchema: JsonSchema = {
  type: "object",
  properties: {},
  additionalProperties: false
};

export const CHAT_TOOL_DEFINITIONS: ChatToolDefinition[] = [
  {
    name: "apply_filters",
    description:
      "Apply one or more structured mutual fund filters. Use this instead of naming funds. Filters are additive unless replace is true.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        category: {
          type: "string",
          enum: FILTER_CATEGORIES
        },
        min_aum_cr: {
          type: "number",
          description: "Minimum AUM in crores."
        },
        max_expense_ratio: {
          type: "number",
          description: "Maximum expense ratio percentage, e.g. 1.0."
        },
        min_returns_1y: {
          type: "number"
        },
        min_returns_3y: {
          type: "number"
        },
        min_returns_5y: {
          type: "number"
        },
        min_rating: {
          type: "integer",
          enum: RATINGS
        },
        fund_house: {
          type: "string"
        },
        plan_type: {
          type: "string",
          enum: PLAN_TYPES
        },
        sort_by: {
          type: "string",
          enum: SORT_FIELDS
        },
        order: {
          type: "string",
          enum: SORT_ORDERS
        },
        replace: {
          type: "boolean"
        }
      }
    }
  },
  {
    name: "clear_filters",
    description: "Clear all active filters.",
    input_schema: noArgsSchema
  },
  {
    name: "explain_metric",
    description:
      "Explain a mutual fund metric in plain English using reviewed copy. Use this whenever the user asks what a metric means.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["metric"],
      properties: {
        metric: {
          type: "string",
          enum: METRIC_NAMES
        },
        context: {
          type: "string"
        }
      }
    }
  },
  {
    name: "save_filter",
    description:
      "Save the current client-owned filter state under the provided name. Do not include filter values in this tool input.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["name"],
      properties: {
        name: {
          type: "string"
        }
      }
    }
  },
  {
    name: "load_saved_filter",
    description: "Load a saved filter set by name and replace the current filter state.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["name"],
      properties: {
        name: {
          type: "string"
        }
      }
    }
  },
  {
    name: "list_saved_filters",
    description: "List saved filter names so the assistant can answer without inventing names.",
    input_schema: noArgsSchema
  }
];

const applyFiltersInputSchema = z
  .object({
    category: z.enum(FILTER_CATEGORIES).optional(),
    min_aum_cr: z.number().finite().optional(),
    max_expense_ratio: z.number().finite().optional(),
    min_returns_1y: z.number().finite().optional(),
    min_returns_3y: z.number().finite().optional(),
    min_returns_5y: z.number().finite().optional(),
    min_rating: z.enum(["1", "2", "3", "4", "5"]).or(z.number().int().min(1).max(5)).optional(),
    fund_house: z.string().trim().min(1).optional(),
    plan_type: z.enum(PLAN_TYPES).optional(),
    sort_by: z.enum(SORT_FIELDS).optional(),
    order: z.enum(SORT_ORDERS).optional(),
    replace: z.boolean().optional()
  })
  .strict()
  .transform((input) => ({
    ...input,
    min_rating:
      typeof input.min_rating === "string" ? (Number(input.min_rating) as 1 | 2 | 3 | 4 | 5) : input.min_rating
  }));

const clearFiltersInputSchema = z.object({}).strict();
const explainMetricInputSchema = z
  .object({
    metric: z.enum(METRIC_NAMES),
    context: z.string().trim().min(1).optional()
  })
  .strict();
const saveFilterInputSchema = z
  .object({
    name: z.string().trim().min(1)
  })
  .strict();
const loadSavedFilterInputSchema = saveFilterInputSchema;
const listSavedFiltersInputSchema = z.object({}).strict();

export const CHAT_TOOL_INPUT_SCHEMAS = {
  apply_filters: applyFiltersInputSchema,
  clear_filters: clearFiltersInputSchema,
  explain_metric: explainMetricInputSchema,
  save_filter: saveFilterInputSchema,
  load_saved_filter: loadSavedFilterInputSchema,
  list_saved_filters: listSavedFiltersInputSchema
};

export const METRIC_EXPLANATIONS: Record<MetricName, string> = {
  expense_ratio:
    "Expense ratio is the yearly fee a fund charges to manage your money. Lower is generally better, because it leaves more of the fund return with you.",
  aum:
    "AUM means assets under management: the total money investors have put into the fund. Very small AUM can be less stable, while very large AUM can sometimes be slower to move.",
  sharpe_ratio:
    "Sharpe ratio compares return with volatility. A higher Sharpe ratio means the fund has delivered more return for each unit of risk taken.",
  alpha:
    "Alpha measures how much a fund outperformed or underperformed its benchmark after adjusting for market movement. Positive alpha means the fund added value versus the benchmark.",
  beta:
    "Beta measures how much a fund tends to move compared with the market. A beta above 1 usually means more market sensitivity; below 1 usually means less.",
  exit_load:
    "Exit load is a fee charged if you redeem units before a stated holding period. It matters most if you might need to withdraw soon.",
  category_definition:
    "A fund category groups funds by what they mainly invest in, such as large-cap equity, debt, hybrid, or index funds. Comparing funds within the same category is usually more meaningful."
};

export type ParseChatToolCallResult =
  | {
      ok: true;
      toolCall: ChatToolCall;
    }
  | {
      ok: false;
      error: string;
    };

export function parseChatToolCall(id: string, name: string, input: unknown): ParseChatToolCallResult {
  if (!isToolName(name)) {
    return {
      ok: false,
      error: "Invalid tool call."
    };
  }

  const schema = CHAT_TOOL_INPUT_SCHEMAS[name];
  const parsed = schema.safeParse(input ?? {});

  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid tool input."
    };
  }

  return {
    ok: true,
    toolCall: {
      id,
      name,
      input: parsed.data as ToolInputMap[typeof name]
    } as ChatToolCall
  };
}

export function explainMetric(metric: MetricName, context?: string): string {
  const baseExplanation = METRIC_EXPLANATIONS[metric];

  if (!context?.trim()) {
    return baseExplanation;
  }

  return `${baseExplanation} In this screen, use it as context rather than as a recommendation by itself.`;
}

function isToolName(name: string): name is ToolName {
  return CHAT_TOOL_DEFINITIONS.some((tool) => tool.name === name);
}
