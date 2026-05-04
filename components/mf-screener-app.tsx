"use client";

import * as React from "react";
import { ShieldCheck } from "lucide-react";

import { ChatPanel } from "@/components/chat-panel";
import { FundResults } from "@/components/fund-results";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { useChatController } from "@/hooks/use-chat-controller";
import { useFunds } from "@/hooks/use-funds";
import { useFiltersStore } from "@/lib/store/filters";
import type { ChatToolExecutionResult } from "@/lib/chat-tool-executor";
import type { MobileView } from "@/lib/ui-types";
import { cn } from "@/lib/utils";

const starterPrompts = [
  "Show me tax-saving funds with strong 3-year returns",
  "Find large cap direct plans with expense ratio under 1%",
  "I want stable funds for retirement",
  "Large cap funds with >15% 3-year returns"
];

export function MfScreenerApp() {
  const filters = useFiltersStore((state) => state.filters);
  const [mobileView, setMobileView] = React.useState<MobileView>("chat");
  const hasActiveFilters = Object.keys(filters).length > 0;
  const fundsResult = useFunds(filters, {
    enabled: hasActiveFilters
  });
  const chat = useChatController({
    onToolResult: (result) => {
      if (shouldRefreshResults(result)) {
        fundsResult.refetch();
      }
    }
  });

  const submitStarterPrompt = React.useCallback(
    (prompt: string) => {
      void chat.sendMessage(prompt);
    },
    [chat]
  );

  return (
    <main className="min-h-screen bg-background lg:h-screen lg:max-h-screen lg:overflow-hidden">
      <div className="flex min-h-screen w-full flex-col px-3 py-3 sm:px-4 lg:h-full lg:min-h-0 lg:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">MF Screener AI</p>
            <h1 className="text-xl font-semibold tracking-normal text-foreground sm:text-2xl">
              Conversational mutual fund screening
            </h1>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" variant="secondary">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Data-first screening
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Data-first screening</DialogTitle>
                <DialogDescription>
                  The assistant turns plain-language requests into structured filters, then the
                  results table shows the matching funds and metrics.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm leading-6 text-foreground">
                <section className="space-y-1">
                  <h2 className="font-medium">How screening works</h2>
                  <p className="text-muted-foreground">
                    Chat responses apply filter changes such as category, returns, expense ratio,
                    risk metrics, plan type, fund house, and sorting. Fund names and figures come
                    from the table, not from model memory.
                  </p>
                </section>
                <section className="space-y-1">
                  <h2 className="font-medium">Data sources</h2>
                  <p className="text-muted-foreground">
                    The app reads screening rows from Supabase through the funds API. NAV data is
                    seeded from AMFI, with available AUM, expense, return, risk, minimum SIP, and
                    exit-load enrichment joined during ingestion.
                  </p>
                </section>
              </div>
            </DialogContent>
          </Dialog>
        </header>

        <div className="grid grid-cols-2 gap-2 py-3 lg:hidden">
          <button
            className={cn(
              "h-9 rounded-md border text-sm font-medium",
              mobileView === "chat"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground"
            )}
            onClick={() => setMobileView("chat")}
            type="button"
          >
            Chat
          </button>
          <button
            className={cn(
              "h-9 rounded-md border text-sm font-medium",
              mobileView === "results"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground"
            )}
            onClick={() => setMobileView("results")}
            type="button"
          >
            Results
          </button>
        </div>

        <section className="grid flex-1 gap-4 py-3 lg:min-h-0 lg:grid-cols-[minmax(280px,1fr)_minmax(0,4fr)]">
          <div className={cn("lg:min-h-0", mobileView !== "chat" && "hidden lg:block")}>
            <ChatPanel
              chat={chat}
              filters={filters}
              hasActiveFilters={hasActiveFilters}
              onShowResults={() => setMobileView("results")}
              onStarterPrompt={submitStarterPrompt}
              starterPrompts={starterPrompts}
            />
          </div>
          <div className={cn("lg:min-h-0", mobileView !== "results" && "hidden lg:block")}>
            <FundResults fundsResult={fundsResult} />
          </div>
        </section>
      </div>
    </main>
  );
}

function shouldRefreshResults(result: ChatToolExecutionResult): boolean {
  return (
    result.status === "filters_applied" ||
    result.status === "filters_cleared" ||
    result.status === "loaded"
  );
}
