"use client";

import * as React from "react";
import { ArrowRight, Loader2, RotateCcw, Search, Send } from "lucide-react";

import { ChatAuthCta } from "@/components/chat-auth-cta";
import { Button } from "@/components/ui/button";
import type { UseChatControllerResult } from "@/hooks/use-chat-controller";
import { cn } from "@/lib/utils";

type ChatPanelProps = {
  chat: UseChatControllerResult;
  hasActiveFilters: boolean;
  onShowResults: () => void;
  onStarterPrompt: (prompt: string) => void;
  starterPrompts: string[];
};

export function ChatPanel({
  chat,
  hasActiveFilters,
  onShowResults,
  onStarterPrompt,
  starterPrompts
}: ChatPanelProps) {
  const [input, setInput] = React.useState("");
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);
  const isStreaming = chat.status === "streaming";
  const showStarterPrompts = chat.messages.length === 0;

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({
      block: "end"
    });
  }, [chat.messages, chat.toolStatus]);

  async function submitMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextMessage = input;
    setInput("");
    await chat.sendMessage(nextMessage);
  }

  return (
    <section className="flex min-h-[calc(100vh-8rem)] flex-col rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Search className="h-4 w-4" aria-hidden="true" />
          Chat
        </div>
        <div className="flex items-center gap-2">
          {chat.messages.length > 0 ? (
            <Button size="sm" variant="ghost" onClick={chat.reset}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Reset
            </Button>
          ) : null}
          <ChatAuthCta />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {showStarterPrompts ? (
            <div className="flex h-full flex-col justify-end gap-4">
              <div className="grid gap-2">
                {starterPrompts.map((prompt) => (
                  <button
                    className="flex w-full items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                    key={prompt}
                    onClick={() => onStarterPrompt(prompt)}
                    type="button"
                  >
                    <span>{prompt}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              {chat.messages.map((message) => (
                <div
                  className={cn(
                    "flex",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                  key={message.id}
                >
                  <div
                    className={cn(
                      "max-w-[85%] whitespace-pre-wrap rounded-md px-3 py-2 text-sm leading-6",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground",
                      message.status === "error" && "bg-destructive/10 text-destructive"
                    )}
                  >
                    {message.content || (message.status === "streaming" ? "Working..." : "")}
                  </div>
                </div>
              ))}

              {chat.toolStatus ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {chat.toolStatus.label}
                </div>
              ) : null}

              {chat.error ? <p className="text-sm text-destructive">{chat.error}</p> : null}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="border-t border-border p-4">
          {hasActiveFilters ? (
            <Button
              className="mb-3 w-full lg:hidden"
              onClick={onShowResults}
              type="button"
              variant="secondary"
            >
              Show results
            </Button>
          ) : null}
          <form className="flex gap-2" onSubmit={(event) => void submitMessage(event)}>
            <label className="sr-only" htmlFor="chat-input">
              Message
            </label>
            <textarea
              className="min-h-10 flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
              disabled={isStreaming}
              id="chat-input"
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Ask for funds..."
              rows={1}
              value={input}
            />
            <Button disabled={isStreaming || !input.trim()} size="icon" type="submit">
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
              <span className="sr-only">Send</span>
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}
