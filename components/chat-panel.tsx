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
  const [isHydrated, setIsHydrated] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);
  const isStreaming = chat.status === "streaming";
  const isComposerDisabled = !isHydrated || isStreaming;
  const showStarterPrompts = chat.messages.length === 0;

  React.useEffect(() => {
    setIsHydrated(true);
  }, []);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({
      block: "end"
    });
  }, [chat.messages, chat.toolStatus]);

  async function submitMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextMessage = String(formData.get("message") ?? input);

    event.currentTarget.reset();
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
            <div className="grid gap-4" aria-live="polite" aria-relevant="additions text">
              {chat.messages.map((message) => {
                const isUserMessage = message.role === "user";
                const isStreamingMessage = message.status === "streaming";

                return (
                  <div
                    className={cn("flex", isUserMessage ? "justify-end" : "justify-start")}
                    key={message.id}
                  >
                    <div
                      className={cn(
                        "whitespace-pre-wrap text-sm leading-6",
                        isUserMessage
                          ? "max-w-[85%] rounded-md bg-primary px-3 py-2 text-primary-foreground"
                          : "max-w-full flex-1 px-1 py-1 text-foreground",
                        message.status === "error" &&
                          "rounded-md bg-destructive/10 px-3 py-2 text-destructive"
                      )}
                    >
                      {message.content ? (
                        <>
                          {isUserMessage ? (
                            message.content
                          ) : (
                            <AssistantMessageContent content={message.content} />
                          )}
                          {!isUserMessage && isStreamingMessage ? (
                            <span
                              className="ml-0.5 inline-block h-4 w-1 translate-y-[2px] animate-pulse rounded-full bg-primary"
                              aria-hidden="true"
                            />
                          ) : null}
                        </>
                      ) : !isUserMessage && isStreamingMessage ? (
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                          Thinking
                          <span className="inline-flex gap-1" aria-hidden="true">
                            <span className="h-1 w-1 animate-pulse rounded-full bg-current" />
                            <span className="h-1 w-1 animate-pulse rounded-full bg-current [animation-delay:120ms]" />
                            <span className="h-1 w-1 animate-pulse rounded-full bg-current [animation-delay:240ms]" />
                          </span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}

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
              disabled={isComposerDisabled}
              id="chat-input"
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              name="message"
              placeholder="Ask for funds..."
              required
              rows={1}
              value={input}
            />
            <Button disabled={isComposerDisabled} size="icon" type="submit">
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

function AssistantMessageContent({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/).filter((block) => block.trim());

  if (blocks.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {blocks.map((block, blockIndex) => (
        <AssistantMessageBlock block={block} key={`${block}-${blockIndex}`} />
      ))}
    </div>
  );
}

function AssistantMessageBlock({ block }: { block: string }) {
  const lines = block.split("\n").filter((line) => line.trim());

  if (lines.length === 0) {
    return null;
  }

  if (lines[0]?.trimStart().startsWith("- ")) {
    return (
      <ul className="space-y-1">
        {lines.map((line, index) => (
          <li className="grid grid-cols-[0.625rem_1fr] gap-2" key={`${line}-${index}`}>
            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary/70" aria-hidden="true" />
            <span>{line.replace(/^-\s*/, "")}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-1">
      {lines.map((line, index) => {
        const trimmedLine = line.trim();
        const heading = trimmedLine.startsWith("**")
          ? trimmedLine.replace(/^\*\*/, "").replace(/\*\*$/, "")
          : null;
        const note =
          trimmedLine.startsWith("_") && trimmedLine.endsWith("_")
            ? trimmedLine.slice(1, -1)
            : null;

        if (heading) {
          return (
            <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground" key={line}>
              {heading}
            </p>
          );
        }

        if (note) {
          return (
            <p className="text-xs text-muted-foreground" key={line}>
              {note}
            </p>
          );
        }

        return <p key={`${line}-${index}`}>{trimmedLine}</p>;
      })}
    </div>
  );
}
