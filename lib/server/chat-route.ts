import { NextResponse } from "next/server";
import { z } from "zod";

import { CHAT_TOOL_DEFINITIONS, parseChatToolCall } from "@/lib/chat-tools";
import { MF_SCREENER_SYSTEM_PROMPT } from "@/lib/prompts";
import type { ChatMessage, ChatSseEvent } from "@/lib/types";

export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(4000)
      })
    )
    .min(1)
    .max(50)
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
  model = process.env.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL
): AnthropicChatRequest {
  return {
    max_tokens: 700,
    messages,
    model,
    stream: true,
    system: MF_SCREENER_SYSTEM_PROMPT,
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

  try {
    rawStream = await options.createStream(
      buildAnthropicChatRequest(parsed.data.messages, options.model)
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
    logger = console
  }: {
    enqueue: (event: ChatSseEvent) => void;
    logger?: Pick<Console, "error">;
  }
) {
  const pendingTools = new Map<number, PendingToolBlock>();

  try {
    for await (const event of rawStream) {
      if (!isRawChatStreamEvent(event)) {
        continue;
      }

      if (event.type === "content_block_start" && event.index !== undefined && event.content_block) {
        if (isTextStartBlock(event.content_block) && event.content_block.text) {
          enqueue({
            type: "text_delta",
            text: event.content_block.text
          });
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
          enqueue({
            type: "text_delta",
            text: event.delta.text
          });
        }

        if (isInputJsonDelta(event.delta) && pendingTool) {
          pendingTool.partialJson += event.delta.partial_json;
        }
      }

      if (event.type === "content_block_stop" && event.index !== undefined) {
        const pendingTool = pendingTools.get(event.index);

        if (pendingTool) {
          emitCompletedToolCall(pendingTool, enqueue);
          pendingTools.delete(event.index);
        }
      }
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
