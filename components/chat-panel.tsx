"use client";

import * as React from "react";
import { ArrowRight, Loader2, RotateCcw, Search, Send, SlidersHorizontal } from "lucide-react";

import { ChatAuthCta } from "@/components/chat-auth-cta";
import { Button } from "@/components/ui/button";
import type { UseChatControllerResult } from "@/hooks/use-chat-controller";
import type { FilterCategory, FilterState } from "@/lib/types";
import { cn } from "@/lib/utils";

type ChatPanelProps = {
  chat: UseChatControllerResult;
  filters: FilterState;
  hasActiveFilters: boolean;
  onShowResults: () => void;
  onStarterPrompt: (prompt: string) => void;
  starterPrompts: string[];
};

type RefinementSuggestion = {
  label: string;
  prompt: string;
};

const RETURN_5Y_FLOOR_BY_CATEGORY: Partial<Record<FilterCategory, number>> = {
  Debt: 7,
  ELSS: 12,
  "Flexi Cap": 12,
  Hybrid: 10,
  Index: 10,
  "Large Cap": 12,
  "Mid Cap": 14,
  "Small Cap": 14
};

const EXPENSE_CAP_BY_CATEGORY: Partial<Record<FilterCategory, number>> = {
  Debt: 0.5,
  ELSS: 1,
  "Flexi Cap": 1,
  Hybrid: 1,
  Index: 0.3,
  "Large Cap": 1,
  "Mid Cap": 1,
  "Small Cap": 1.25
};

export function ChatPanel({
  chat,
  filters,
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
  const refinementSuggestions = React.useMemo(() => getRefinementSuggestions(filters), [filters]);
  const showRefinementSuggestions =
    !showStarterPrompts && !isStreaming && refinementSuggestions.length > 0;

  React.useEffect(() => {
    setIsHydrated(true);
  }, []);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({
      block: "end"
    });
  }, [chat.messages, chat.toolStatus, refinementSuggestions.length]);

  async function submitMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextMessage = String(formData.get("message") ?? input);

    event.currentTarget.reset();
    setInput("");
    await chat.sendMessage(nextMessage);
  }

  return (
    <section className="flex min-h-[calc(100vh-8rem)] flex-col rounded-lg border border-border bg-card lg:h-full lg:min-h-0">
      <div className="border-b border-border bg-muted/30 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <Search className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2 className="truncate text-sm font-semibold text-foreground">Chat</h2>
          </div>
          {chat.messages.length > 0 ? (
            <Button
              aria-label="Reset chat"
              className="h-9 w-9 shrink-0 text-muted-foreground"
              onClick={chat.reset}
              size="icon"
              title="Reset chat"
              type="button"
              variant="ghost"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
        <div className="mt-3 min-w-0">
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
              {showRefinementSuggestions ? (
                <RefinementSuggestions
                  disabled={isComposerDisabled}
                  onSelect={(prompt) => {
                    void chat.sendMessage(prompt);
                  }}
                  suggestions={refinementSuggestions}
                />
              ) : null}
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

function RefinementSuggestions({
  disabled,
  onSelect,
  suggestions
}: {
  disabled: boolean;
  onSelect: (prompt: string) => void;
  suggestions: RefinementSuggestion[];
}) {
  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-muted-foreground">
        <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
        Refine
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <button
            aria-label={`Refine filters: ${suggestion.label}`}
            className="rounded-md border border-border bg-background px-2.5 py-1.5 text-left text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
            disabled={disabled}
            key={suggestion.prompt}
            onClick={() => onSelect(suggestion.prompt)}
            type="button"
          >
            {suggestion.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function getRefinementSuggestions(filters?: FilterState | null): RefinementSuggestion[] {
  if (!filters || Object.keys(filters).length === 0) {
    return [];
  }

  const suggestions: RefinementSuggestion[] = [];
  const addSuggestion = (suggestion: RefinementSuggestion, skip: boolean) => {
    if (!skip) {
      suggestions.push(suggestion);
    }
  };
  const isTaxSavingScreen = filters.category === "ELSS";
  const expenseCap = getExpenseCap(filters.category);
  const returns5yFloor = getReturns5yFloor(filters.category);

  addSuggestion(
    {
      label: isTaxSavingScreen ? "Direct ELSS only" : "Direct plans only",
      prompt: isTaxSavingScreen
        ? buildRefinementPrompt("add a plan type filter for Direct ELSS plans")
        : buildRefinementPrompt("add a plan type filter for Direct plans")
    },
    filters.plan_type === "Direct"
  );

  addSuggestion(
    {
      label: `Expense <= ${formatCompactPercent(expenseCap)}`,
      prompt: buildRefinementPrompt(
        `add an expense ratio cap of ${formatCompactPercent(expenseCap)} or lower`
      )
    },
    filters.max_expense_ratio !== undefined && filters.max_expense_ratio <= expenseCap
  );

  addSuggestion(
    {
      label: `5Y >= ${formatCompactPercent(returns5yFloor)}`,
      prompt: buildRefinementPrompt(
        `require at least ${formatCompactPercent(returns5yFloor)} 5-year returns`
      )
    },
    filters.min_returns_5y !== undefined && filters.min_returns_5y >= returns5yFloor
  );

  addSuggestion(
    {
      label: "Sharpe >= 1",
      prompt: buildRefinementPrompt("require Sharpe ratio of at least 1")
    },
    filters.min_sharpe_ratio !== undefined && filters.min_sharpe_ratio >= 1
  );

  addSuggestion(
    {
      label: "Lower volatility",
      prompt: buildRefinementPrompt(
        "rank the same matching funds by lower standard deviation first"
      )
    },
    filters.sort_by === "standard_deviation"
  );

  addSuggestion(
    {
      label: "Top 10 rows",
      prompt: filters.sort_by
        ? buildRefinementPrompt("limit the current ranked screen to the top 10 rows")
        : buildRefinementPrompt(
            "show the top 10 rows ranked by 3-year returns from highest to lowest"
          )
    },
    filters.limit === 10
  );

  return suggestions.slice(0, 4);
}

function buildRefinementPrompt(action: string): string {
  return `Use the current UI context as the base screen, keep every existing filter, and ${action}.`;
}

function getExpenseCap(category?: FilterCategory): number {
  return category ? (EXPENSE_CAP_BY_CATEGORY[category] ?? 1) : 1;
}

function getReturns5yFloor(category?: FilterCategory): number {
  return category ? (RETURN_5Y_FLOOR_BY_CATEGORY[category] ?? 12) : 12;
}

function formatCompactPercent(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}%`;
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
