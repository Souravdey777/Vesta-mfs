"use client";

import * as React from "react";

import {
  executeChatToolCall,
  type ChatToolExecutionResult,
  type ChatToolExecutorOptions
} from "@/lib/chat-tool-executor";
import {
  buildAppliedFiltersMessage,
  buildLoadedFiltersMessage
} from "@/lib/chat-filter-explanations";
import {
  guardAssistantStreamingText,
  guardAssistantStructuredText,
  guardAssistantText
} from "@/lib/chat-guardrails";
import type { ChatMessage, ChatSseEvent } from "@/lib/types";
import type { ChatStreamStatus, ChatToolStatus, ChatUiMessage } from "@/lib/ui-types";

type UseChatControllerOptions = ChatToolExecutorOptions & {
  fetcher?: typeof fetch;
  onToolResult?: (result: ChatToolExecutionResult) => void;
};

type StreamingTextState = {
  finish?: () => void;
  status: NonNullable<ChatUiMessage["status"]>;
  target: string;
  timeout: ReturnType<typeof setTimeout> | null;
  visible: string;
};

const STREAM_TICK_MS = 14;
const STREAM_CHARS_PER_TICK = 4;

export type UseChatControllerResult = {
  error: string | null;
  messages: ChatUiMessage[];
  reset: () => void;
  sendMessage: (content: string) => Promise<void>;
  status: ChatStreamStatus;
  toolStatus: ChatToolStatus;
};

export function useChatController({
  fetcher = fetch,
  onToolResult,
  storage,
  supabase
}: UseChatControllerOptions = {}): UseChatControllerResult {
  const [messages, setMessages] = React.useState<ChatUiMessage[]>([]);
  const [status, setStatus] = React.useState<ChatStreamStatus>("idle");
  const [toolStatus, setToolStatus] = React.useState<ChatToolStatus>(null);
  const [error, setError] = React.useState<string | null>(null);
  const messagesRef = React.useRef<ChatUiMessage[]>([]);
  const streamingTextRef = React.useRef(new Map<string, StreamingTextState>());

  React.useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const clearStreamingText = React.useCallback(() => {
    for (const state of streamingTextRef.current.values()) {
      if (state.timeout) {
        clearTimeout(state.timeout);
      }
    }

    streamingTextRef.current.clear();
  }, []);

  const updateAssistantMessage = React.useCallback(
    (id: string, updates: Pick<ChatUiMessage, "content" | "status">) => {
      setMessages((current) =>
        current.map((message) => (message.id === id ? { ...message, ...updates } : message))
      );
    },
    []
  );

  const scheduleStreamingText = React.useCallback(
    (id: string) => {
      const state = streamingTextRef.current.get(id);

      if (!state || state.timeout) {
        return;
      }

      state.timeout = setTimeout(() => {
        const current = streamingTextRef.current.get(id);

        if (!current) {
          return;
        }

        current.timeout = null;

        if (!current.target.startsWith(current.visible)) {
          current.visible = "";
        }

        if (current.visible.length < current.target.length) {
          const nextLength = Math.min(
            current.target.length,
            current.visible.length + STREAM_CHARS_PER_TICK
          );
          current.visible = current.target.slice(0, nextLength);
          updateAssistantMessage(id, {
            content: current.visible,
            status: current.status
          });
        }

        if (current.visible.length < current.target.length) {
          scheduleStreamingText(id);
          return;
        }

        updateAssistantMessage(id, {
          content: current.target,
          status: current.status
        });
        current.finish?.();
        streamingTextRef.current.delete(id);
      }, STREAM_TICK_MS);
    },
    [updateAssistantMessage]
  );

  const queueAssistantText = React.useCallback(
    (id: string, target: string) => {
      const state = streamingTextRef.current.get(id) ?? {
        status: "streaming",
        target: "",
        timeout: null,
        visible: messagesRef.current.find((message) => message.id === id)?.content ?? ""
      };

      state.status = "streaming";
      state.target = target;
      streamingTextRef.current.set(id, state);
      scheduleStreamingText(id);
    },
    [scheduleStreamingText]
  );

  const finishAssistantText = React.useCallback(
    (id: string, target: string, nextStatus: NonNullable<ChatUiMessage["status"]>) =>
      new Promise<void>((resolve) => {
        const state = streamingTextRef.current.get(id) ?? {
          status: nextStatus,
          target: "",
          timeout: null,
          visible: messagesRef.current.find((message) => message.id === id)?.content ?? ""
        };

        state.finish = resolve;
        state.status = nextStatus;
        state.target = target;
        streamingTextRef.current.set(id, state);
        scheduleStreamingText(id);

        if (state.visible === state.target && !state.timeout) {
          updateAssistantMessage(id, {
            content: state.target,
            status: nextStatus
          });
          streamingTextRef.current.delete(id);
          resolve();
        }
      }),
    [scheduleStreamingText, updateAssistantMessage]
  );

  React.useEffect(
    () => () => clearStreamingText(),
    [clearStreamingText]
  );

  const sendMessage = React.useCallback(
    async (content: string) => {
      const trimmedContent = content.trim();

      if (!trimmedContent || status === "streaming") {
        return;
      }

      const userMessage: ChatUiMessage = {
        id: createMessageId("user"),
        role: "user",
        content: trimmedContent,
        status: "complete"
      };
      const assistantMessage: ChatUiMessage = {
        id: createMessageId("assistant"),
        role: "assistant",
        content: "",
        status: "streaming"
      };
      const apiMessages = toApiMessages([...messagesRef.current, userMessage]);
      const assistantId = assistantMessage.id;
      const fallbackMessages: string[] = [];
      let toolSummaryMessage: string | null = null;

      setMessages((current) => [...current, userMessage, assistantMessage]);
      setStatus("streaming");
      setToolStatus(null);
      setError(null);

      try {
        const response = await fetcher("/api/chat", {
          body: JSON.stringify({
            messages: apiMessages
          }),
          headers: {
            "content-type": "application/json"
          },
          method: "POST"
        });

        if (!response.ok || !response.body) {
          throw new Error("Unable to start chat right now.");
        }

        let assistantText = "";

        await readChatSse(response.body, async (event) => {
          if (event.type === "text_delta") {
            assistantText += event.text;
            queueAssistantText(assistantId, guardAssistantStreamingText(assistantText).text);
            return;
          }

          if (event.type === "tool_call") {
            setToolStatus({
              label: getToolStatusLabel(event.toolCall.name),
              toolCall: event.toolCall
            });
            const result = await executeChatToolCall(event.toolCall, {
              storage,
              supabase
            });
            onToolResult?.(result);
            setToolStatus(null);
            const fallback = getToolResultMessage(result);

            if (fallback) {
              fallbackMessages.push(fallback);
            }

            if (isFilterSummaryResult(result)) {
              toolSummaryMessage = fallback;
              assistantText = fallback ?? assistantText;
              queueAssistantText(assistantId, guardAssistantStructuredText(assistantText).text);
            }

            if (result.status === "metric_explained") {
              assistantText = joinAssistantText(assistantText, result.message);
              queueAssistantText(assistantId, guardAssistantStreamingText(assistantText).text);
            }
            return;
          }

          if (event.type === "error") {
            throw new Error(event.error);
          }
        });

        const finalAssistantText = toolSummaryMessage
          ? guardAssistantStructuredText(toolSummaryMessage).text
          : assistantText.trim()
            ? guardAssistantText(assistantText).text
            : fallbackMessages[0] ?? "";

        setToolStatus(null);
        await finishAssistantText(
          assistantId,
          finalAssistantText || "Done. Check the results table for the latest screen.",
          "complete"
        );
        setStatus("idle");
      } catch (sendError) {
        const message =
          sendError instanceof Error ? sendError.message : "Unable to continue this chat.";
        setError(message);
        await finishAssistantText(
          assistantId,
          "I could not complete that request. Please try again.",
          "error"
        );
        setStatus("error");
        setToolStatus(null);
      }
    },
    [fetcher, finishAssistantText, onToolResult, queueAssistantText, status, storage, supabase]
  );

  const reset = React.useCallback(() => {
    clearStreamingText();
    setMessages([]);
    setStatus("idle");
    setToolStatus(null);
    setError(null);
  }, [clearStreamingText]);

  return {
    error,
    messages,
    reset,
    sendMessage,
    status,
    toolStatus
  };
}

export async function readChatSse(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: ChatSseEvent) => Promise<void> | void
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, {
      stream: true
    });
    const parsed = splitSseBuffer(buffer);
    buffer = parsed.remainder;

    for (const chunk of parsed.chunks) {
      const event = parseChatSseEvent(chunk);

      if (event && event.type !== "done") {
        await onEvent(event);
      }
    }
  }

  buffer += decoder.decode();

  if (buffer.trim()) {
    const event = parseChatSseEvent(buffer);

    if (event && event.type !== "done") {
      await onEvent(event);
    }
  }
}

export function parseChatSseEvent(chunk: string): ChatSseEvent | null {
  const data = chunk
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trimStart())
    .join("\n");

  if (!data) {
    return null;
  }

  return JSON.parse(data) as ChatSseEvent;
}

function splitSseBuffer(buffer: string) {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const chunks: string[] = [];
  let remainder = normalized;
  let separatorIndex = remainder.indexOf("\n\n");

  while (separatorIndex >= 0) {
    chunks.push(remainder.slice(0, separatorIndex));
    remainder = remainder.slice(separatorIndex + 2);
    separatorIndex = remainder.indexOf("\n\n");
  }

  return {
    chunks,
    remainder
  };
}

function toApiMessages(messages: ChatUiMessage[]): ChatMessage[] {
  return messages
    .filter((message) => message.content.trim())
    .map((message) => ({
      role: message.role,
      content: message.content
    }));
}

function getToolStatusLabel(toolName: string): string {
  switch (toolName) {
    case "apply_filters":
      return "Applying filters...";
    case "clear_filters":
      return "Clearing filters...";
    case "explain_metric":
      return "Explaining metric...";
    case "save_filter":
      return "Saving screen...";
    case "load_saved_filter":
      return "Loading saved screen...";
    case "list_saved_filters":
      return "Checking saved screens...";
    default:
      return "Working...";
  }
}

function getToolResultMessage(result: ChatToolExecutionResult): string | null {
  switch (result.status) {
    case "filters_applied":
      return buildAppliedFiltersMessage(result.filters);
    case "filters_cleared":
      return "Cleared filters. Start a new screen when you are ready.";
    case "metric_explained":
      return result.message;
    case "saved":
      return `Saved this screen as ${result.savedName}. You can load it from chat or the saved screens menu.`;
    case "overwrite_required":
      return `A saved screen named ${result.savedName} already exists. Use the saved filters menu to overwrite it.`;
    case "invalid_name":
      return "Use a short name before saving this screen. Saved screen names keep your filters easy to reload.";
    case "loaded":
      return buildLoadedFiltersMessage(result.savedName ?? "saved screen", result.filters ?? {});
    case "not_found":
      return result.availableNames?.length
        ? `I could not find that saved screen. Available screens: ${result.availableNames.join(", ")}.`
        : "I could not find that saved screen. Save a screen first, then load it by name.";
    case "listed":
      return result.names.length
        ? `Saved screens: ${result.names.join(", ")}. Load one by name when you want to reuse it.`
        : "No saved screens yet. Save a filtered view to reuse it later.";
    default:
      return null;
  }
}

function joinAssistantText(current: string, next: string): string {
  if (!current.trim()) {
    return next;
  }

  return `${current.trim()}\n\n${next}`;
}

function isFilterSummaryResult(result: ChatToolExecutionResult): boolean {
  return result.status === "filters_applied" || result.status === "loaded";
}

function createMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
