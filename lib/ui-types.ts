import type { ChatToolCall } from "@/lib/types";

export type ChatUiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "streaming" | "complete" | "error";
};

export type ChatStreamStatus = "idle" | "streaming" | "error";

export type ChatToolStatus = {
  label: string;
  toolCall?: ChatToolCall;
} | null;

export type MobileView = "chat" | "results";
