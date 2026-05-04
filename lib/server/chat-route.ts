import { NextResponse } from "next/server";
import { z } from "zod";

import { guardAssistantText, type ChatGuardrailOptions } from "@/lib/chat-guardrails";
import {
  buildUiContextSystemPrompt,
  getAllowedFundNamesFromUiContext,
  MAX_CHAT_VISIBLE_FUNDS
} from "@/lib/chat-ui-context";
import { CHAT_TOOL_DEFINITIONS, parseChatToolCall } from "@/lib/chat-tools";
import { MF_SCREENER_SYSTEM_PROMPT } from "@/lib/prompts";
import {
  FILTER_CATEGORIES,
  FUND_CATEGORIES,
  MAX_RESULT_LIMIT,
  MIN_RESULT_LIMIT,
  PLAN_TYPES,
  SORT_FIELDS,
  SORT_ORDERS
} from "@/lib/types";
import type { ChatMessage, ChatSseEvent, ChatUiContext } from "@/lib/types";

export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

const nullableNumberSchema = z.number().finite().nullable();
const filterStateSchema = z
  .object({
    category: z.enum(FILTER_CATEGORIES).optional(),
    fund_house: z.string().trim().min(1).max(120).optional(),
    limit: z.number().int().min(MIN_RESULT_LIMIT).max(MAX_RESULT_LIMIT).optional(),
    max_beta: z.number().finite().optional(),
    max_downside_capture_ratio: z.number().finite().optional(),
    max_expense_ratio: z.number().finite().optional(),
    max_standard_deviation: z.number().finite().optional(),
    min_aum_cr: z.number().finite().optional(),
    min_rating: z.number().int().min(1).max(5).optional(),
    min_returns_1y: z.number().finite().optional(),
    min_returns_3y: z.number().finite().optional(),
    min_returns_5y: z.number().finite().optional(),
    min_rolling_returns_3y: z.number().finite().optional(),
    min_sharpe_ratio: z.number().finite().optional(),
    min_upside_capture_ratio: z.number().finite().optional(),
    order: z.enum(SORT_ORDERS).optional(),
    plan_type: z.enum(PLAN_TYPES).optional(),
    sort_by: z.enum(SORT_FIELDS).optional()
  })
  .strict();
const visibleFundSchema = z
  .object({
    aum_cr: nullableNumberSchema,
    beta: nullableNumberSchema,
    category: z.enum(FUND_CATEGORIES),
    downside_capture_ratio: nullableNumberSchema,
    exit_load: z.string().max(500).nullable(),
    expense_ratio: nullableNumberSchema,
    fund_house: z.string().trim().min(1).max(160),
    min_sip: nullableNumberSchema,
    nav: z.number().finite(),
    plan_type: z.enum(PLAN_TYPES),
    rating: z.number().int().min(1).max(5).nullable(),
    returns_1y: nullableNumberSchema,
    returns_3y: nullableNumberSchema,
    returns_3y_vs_category: nullableNumberSchema,
    returns_5y: nullableNumberSchema,
    rolling_returns_3y: nullableNumberSchema,
    scheme_code: z.string().trim().min(1).max(64),
    scheme_name: z.string().trim().min(1).max(240),
    sharpe_ratio: nullableNumberSchema,
    standard_deviation: nullableNumberSchema,
    updated_at: z.string().trim().min(1).max(80),
    upside_capture_ratio: nullableNumberSchema
  })
  .strict();
const zeroStateSchema = z
  .object({
    message: z.string().trim().min(1).max(500),
    reason: z.literal("no_matches"),
    suggestions: z
      .array(
        z
          .object({
            label: z.string().trim().min(1).max(140),
            removeFilter: z.string().trim().min(1).max(80)
          })
          .strict()
      )
      .max(10)
  })
  .strict();
const chatUiContextSchema = z
  .object({
    filters: filterStateSchema,
    results: z
      .object({
        error: z.string().trim().min(1).max(500).nullable().optional(),
        page: z.number().int().min(0).optional(),
        pageCount: z.number().int().min(0).optional(),
        pageSize: z.number().int().min(1).max(100).optional(),
        status: z.enum(["idle", "loading", "success", "error"]),
        total: z.number().int().min(0).optional(),
        visibleFunds: z.array(visibleFundSchema).max(MAX_CHAT_VISIBLE_FUNDS),
        visibleRange: z
          .object({
            end: z.number().int().min(0),
            start: z.number().int().min(0)
          })
          .strict()
          .optional(),
        zeroState: zeroStateSchema.nullable().optional()
      })
      .strict()
  })
  .strict();

const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(4000)
      })
    )
    .min(1)
    .max(50),
  uiContext: chatUiContextSchema.optional()
});

type RawToolUseStartBlock = {
  [key: string]: unknown;
  id: string;
  name: string;
  input?: unknown;
  type: "tool_use";
};

type RawTextStartBlock = {
  [key: string]: unknown;
  text?: string;
  type: "text";
};

export type RawChatStreamEvent = {
  [key: string]: unknown;
  type: string;
  index?: number;
  content_block?: RawTextStartBlock | RawToolUseStartBlock | ({ [key: string]: unknown; type: string });
  delta?:
    | {
        [key: string]: unknown;
        type: "text_delta";
        text: string;
      }
    | {
        [key: string]: unknown;
        type: "input_json_delta";
        partial_json: string;
      }
    | ({ [key: string]: unknown; type: string });
};

export type RawChatStream = AsyncIterable<unknown>;

type AnthropicChatRequest = {
  max_tokens: number;
  messages: ChatMessage[];
  model: string;
  stream: true;
  system: string;
  temperature: number;
  tool_choice: {
    type: "auto";
  };
  tools: typeof CHAT_TOOL_DEFINITIONS;
};

type ChatStreamFactory = (params: AnthropicChatRequest) => Promise<RawChatStream>;

type ChatRouteOptions = {
  createStream: ChatStreamFactory;
  logger?: Pick<Console, "error">;
  model?: string;
};

type PendingToolBlock = {
  id: string;
  name: string;
  input: unknown;
  partialJson: string;
};

export function buildAnthropicChatRequest(
  messages: ChatMessage[],
  model = process.env.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL,
  uiContext?: ChatUiContext
): AnthropicChatRequest {
  const uiContextPrompt = buildUiContextSystemPrompt(uiContext);

  return {
    max_tokens: 700,
    messages,
    model,
    stream: true,
    system: uiContextPrompt
      ? `${MF_SCREENER_SYSTEM_PROMPT}\n\n${uiContextPrompt}`
      : MF_SCREENER_SYSTEM_PROMPT,
    temperature: 0.2,
    tool_choice: {
      type: "auto"
    },
    tools: CHAT_TOOL_DEFINITIONS
  };
}

export async function getChatResponse(request: Request, options: ChatRouteOptions) {
  const body = await readJsonBody(request);
  const parsed = chatRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid chat request.",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join(".") || "body",
          message: issue.message
        }))
      },
      { status: 400 }
    );
  }

  let rawStream: RawChatStream;
  const uiContext = parsed.data.uiContext as ChatUiContext | undefined;
  const guardrailOptions = buildGuardrailOptions(uiContext);

  try {
    rawStream = await options.createStream(
      buildAnthropicChatRequest(parsed.data.messages, options.model, uiContext)
    );
  } catch (error) {
    const logger = options.logger ?? console;
    logger.error("Chat stream creation failed", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Unable to start chat right now."
      },
      { status: 500 }
    );
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      await writeChatSseStream(rawStream, {
        enqueue: (event) => controller.enqueue(encodeSse(event)),
        guardrailOptions,
        logger: options.logger ?? console
      });
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no"
    }
  });
}

export async function writeChatSseStream(
  rawStream: RawChatStream,
  {
    enqueue,
    guardrailOptions,
    logger = console
  }: {
    enqueue: (event: ChatSseEvent) => void;
    guardrailOptions?: ChatGuardrailOptions;
    logger?: Pick<Console, "error">;
  }
) {
  const pendingTools = new Map<number, PendingToolBlock>();
  const pendingTextBlocks = new Map<number, string>();

  try {
    for await (const event of rawStream) {
      if (!isRawChatStreamEvent(event)) {
        continue;
      }

      if (event.type === "content_block_start" && event.index !== undefined && event.content_block) {
        if (isTextStartBlock(event.content_block)) {
          pendingTextBlocks.set(event.index, event.content_block.text ?? "");
        }

        if (isToolUseStartBlock(event.content_block)) {
          pendingTools.set(event.index, {
            id: event.content_block.id,
            name: event.content_block.name,
            input: event.content_block.input ?? {},
            partialJson: ""
          });
        }
      }

      if (event.type === "content_block_delta" && event.index !== undefined && event.delta) {
        const pendingTool = pendingTools.get(event.index);

        if (isTextDelta(event.delta) && event.delta.text) {
          if (pendingTextBlocks.has(event.index)) {
            pendingTextBlocks.set(
              event.index,
              `${pendingTextBlocks.get(event.index) ?? ""}${event.delta.text}`
            );
          } else {
            emitGuardedTextDelta(event.delta.text, enqueue, guardrailOptions);
          }
        }

        if (isInputJsonDelta(event.delta) && pendingTool) {
          pendingTool.partialJson += event.delta.partial_json;
        }
      }

      if (event.type === "content_block_stop" && event.index !== undefined) {
        const pendingText = pendingTextBlocks.get(event.index);
        const pendingTool = pendingTools.get(event.index);

        if (pendingText !== undefined) {
          emitGuardedTextDelta(pendingText, enqueue, guardrailOptions);
          pendingTextBlocks.delete(event.index);
        }

        if (pendingTool) {
          emitCompletedToolCall(pendingTool, enqueue);
          pendingTools.delete(event.index);
        }
      }
    }

    for (const pendingText of pendingTextBlocks.values()) {
      emitGuardedTextDelta(pendingText, enqueue, guardrailOptions);
    }

    enqueue({
      type: "done"
    });
  } catch (error) {
    logger.error("Chat stream failed", error);
    enqueue({
      type: "error",
      error: "Chat stream failed."
    });
  }
}

function emitGuardedTextDelta(
  text: string,
  enqueue: (event: ChatSseEvent) => void,
  guardrailOptions: ChatGuardrailOptions = {}
) {
  const guarded = guardAssistantText(text, guardrailOptions);

  if (!guarded.text) {
    return;
  }

  enqueue({
    type: "text_delta",
    text: guarded.text
  });
}

function buildGuardrailOptions(uiContext?: ChatUiContext): ChatGuardrailOptions {
  return {
    allowedFundNames: getAllowedFundNamesFromUiContext(uiContext)
  };
}

function emitCompletedToolCall(
  pendingTool: PendingToolBlock,
  enqueue: (event: ChatSseEvent) => void
) {
  const parsedInput = parsePendingToolInput(pendingTool);
  const parsedToolCall = parseChatToolCall(pendingTool.id, pendingTool.name, parsedInput);

  if (!parsedToolCall.ok) {
    enqueue({
      type: "error",
      error: parsedToolCall.error
    });
    return;
  }

  enqueue({
    type: "tool_call",
    toolCall: parsedToolCall.toolCall
  });
}

function parsePendingToolInput(pendingTool: PendingToolBlock): unknown {
  const partialJson = pendingTool.partialJson.trim();

  if (!partialJson) {
    return pendingTool.input;
  }

  try {
    return JSON.parse(partialJson);
  } catch {
    return undefined;
  }
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function encodeSse(event: ChatSseEvent): Uint8Array {
  const payload = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
  return new TextEncoder().encode(payload);
}

function isRawChatStreamEvent(value: unknown): value is RawChatStreamEvent {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof value.type === "string"
  );
}

function isTextStartBlock(value: RawChatStreamEvent["content_block"]): value is RawTextStartBlock {
  return value?.type === "text" && (value.text === undefined || typeof value.text === "string");
}

function isToolUseStartBlock(
  value: RawChatStreamEvent["content_block"]
): value is RawToolUseStartBlock {
  return value?.type === "tool_use" && typeof value.id === "string" && typeof value.name === "string";
}

function isTextDelta(value: RawChatStreamEvent["delta"]): value is { type: "text_delta"; text: string } {
  return value?.type === "text_delta" && typeof value.text === "string";
}

function isInputJsonDelta(
  value: RawChatStreamEvent["delta"]
): value is { type: "input_json_delta"; partial_json: string } {
  return value?.type === "input_json_delta" && typeof value.partial_json === "string";
}
