import { ArrowRight, Search, ShieldCheck, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";

const starterPrompts = [
  "Show me tax-saving funds with strong 3-year returns",
  "Find large cap direct plans with expense ratio under 1%",
  "I want stable funds for retirement"
];

const setupItems = [
  "Next.js 14 App Router",
  "Tailwind and shadcn/ui",
  "Supabase-ready data layer",
  "Anthropic tool-calling path"
];

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between border-b border-border py-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">MF Screener</p>
            <h1 className="text-2xl font-semibold tracking-normal text-foreground">
              Conversational mutual fund screening
            </h1>
          </div>
          <Button size="sm">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Setup ready
          </Button>
        </header>

        <section className="grid flex-1 gap-4 py-4 lg:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
          <div className="flex min-h-[560px] flex-col rounded-lg border border-border bg-card">
            <div className="border-b border-border p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Search className="h-4 w-4" aria-hidden="true" />
                Chat
              </div>
            </div>

            <div className="flex flex-1 flex-col justify-end gap-4 p-4">
              <div className="rounded-lg bg-muted p-4 text-sm leading-6 text-muted-foreground">
                Ask for funds in plain English. The assistant will translate your request into
                structured filters, and the table will stay the source of truth.
              </div>

              <div className="space-y-2">
                {starterPrompts.map((prompt) => (
                  <button
                    className="flex w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                    key={prompt}
                    type="button"
                  >
                    <span>{prompt}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex min-h-[560px] flex-col rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                Results
              </div>
              <Button size="sm" variant="secondary">
                Save view
              </Button>
            </div>

            <div className="grid gap-3 p-4 sm:grid-cols-2">
              {setupItems.map((item) => (
                <div className="rounded-md border border-border bg-background p-3" key={item}>
                  <p className="text-sm font-medium text-foreground">{item}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Configured in project setup.</p>
                </div>
              ))}
            </div>

            <div className="flex flex-1 items-center justify-center border-t border-border p-6 text-center text-sm text-muted-foreground">
              Fund table implementation starts in the next todo section.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
