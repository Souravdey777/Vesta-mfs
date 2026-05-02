"use client";

import * as React from "react";

import {
  executeChatToolCall,
  type ChatToolExecutionResult,
  type ChatToolExecutorOptions
} from "@/lib/chat-tool-executor";
import type { ChatMessage, ChatSseEvent } from "@/lib/types";
import type { ChatStreamStatus, ChatToolStatus, ChatUiMessage } from "@/lib/ui-types";

type UseChatControllerOptions = ChatToolExecutorOptions & {
  fetcher?: typeof fetch;
  onToolResult?: (result: ChatToolExecutionResult) => void;
};

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

  React.useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

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
            updateAssistantMessage(assistantId, {
              content: assistantText,
              status: "streaming"
            });
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
            const fallback = getToolResultMessage(result);

            if (fallback) {
              fallbackMessages.push(fallback);
            }

            if (result.status === "metric_explained") {
              assistantText = joinAssistantText(assistantText, result.message);
              updateAssistantMessage(assistantId, {
                content: assistantText,
                status: "streaming"
              });
            }
            return;
          }

          if (event.type === "error") {
            throw new Error(event.error);
          }
        });

        if (!assistantText.trim() && fallbackMessages.length > 0) {
          assistantText = fallbackMessages[0] ?? "";
        }

        updateAssistantMessage(assistantId, {
          content: assistantText || "Done.",
          status: "complete"
        });
        setStatus("idle");
        setToolStatus(null);
      } catch (sendError) {
        const message =
          sendError instanceof Error ? sendError.message : "Unable to continue this chat.";
        setError(message);
        updateAssistantMessage(assistantId, {
          content: "I could not complete that request. Please try again.",
          status: "error"
        });
        setStatus("error");
        setToolStatus(null);
      }
    },
    [fetcher, onToolResult, status, storage, supabase]
  );

  const reset = React.useCallback(() => {
    setMessages([]);
    setStatus("idle");
    setToolStatus(null);
    setError(null);
  }, []);

  function updateAssistantMessage(
    id: string,
    updates: Pick<ChatUiMessage, "content" | "status">
  ) {
    setMessages((current) =>
      current.map((message) => (message.id === id ? { ...message, ...updates } : message))
    );
  }

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
      return "Applied filters. The results are updated.";
    case "filters_cleared":
      return "Cleared filters.";
    case "metric_explained":
      return result.message;
    case "saved":
      return `Saved this screen as ${result.savedName}.`;
    case "overwrite_required":
      return `A saved screen named ${result.savedName} already exists. Use the saved filters menu to overwrite it.`;
    case "invalid_name":
      return "Use a short name before saving this screen.";
    case "loaded":
      return `Loaded ${result.savedName}.`;
    case "not_found":
      return result.availableNames?.length
        ? `I could not find that saved screen. Available screens: ${result.availableNames.join(", ")}.`
        : "I could not find that saved screen.";
    case "listed":
      return result.names.length ? `Saved screens: ${result.names.join(", ")}.` : "No saved screens yet.";
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

function createMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
