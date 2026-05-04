import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getRefinementSuggestions } from "@/components/chat-panel";
import { ChatAuthCta, type AuthSupabaseClient } from "@/components/chat-auth-cta";
import { FilterChips } from "@/components/filter-chips";
import { FundResults } from "@/components/fund-results";
import { FundTable } from "@/components/fund-table";
import { MfScreenerApp } from "@/components/mf-screener-app";
import type { UseFundsResult } from "@/hooks/use-funds";
import { getAuthCallbackUrl } from "@/lib/auth-redirect";
import { resetFiltersStoreForTests, useFiltersStore } from "@/lib/store/filters";
import type { CategoryBenchmark, ChatUiContext, FundRow, FundsQueryData } from "@/lib/types";

describe("MF Screener UI", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetFiltersStoreForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens the data-first screening details modal", () => {
    render(<MfScreenerApp />);

    fireEvent.click(screen.getByRole("button", { name: /data-first screening/i }));

    expect(
      screen.getByRole("dialog", {
        name: /data-first screening/i
      })
    ).toBeInTheDocument();
    expect(screen.getByText("How screening works")).toBeInTheDocument();
    expect(screen.getByText("Data sources")).toBeInTheDocument();
    expect(screen.getByText(/Fund names and figures come from the table/i)).toBeInTheDocument();
    expect(screen.getByText(/NAV data is seeded from AMFI/i)).toBeInTheDocument();
  });

  it("suggests refinements for a tax-saving starter screen", () => {
    expect(
      getRefinementSuggestions({
        category: "ELSS",
        min_returns_3y: 12,
        order: "desc",
        sort_by: "returns_3y"
      }).map((suggestion) => suggestion.label)
    ).toEqual(["Direct ELSS only", "Expense <= 1%", "5Y >= 12%", "Sharpe >= 1"]);
  });

  it("builds screen-aware refinement prompts", () => {
    const suggestions = getRefinementSuggestions({
      category: "Debt",
      sort_by: "returns_3y"
    });

    expect(suggestions.map((suggestion) => suggestion.label)).toEqual([
      "Direct plans only",
      "Expense <= 0.5%",
      "5Y >= 7%",
      "Sharpe >= 1"
    ]);
    expect(suggestions[1].prompt).toBe(
      "Use the current UI context as the base screen, keep every existing filter, and add an expense ratio cap of 0.5% or lower."
    );
  });

  it("submits starter prompts, streams text, executes tool calls, and renders fund rows", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/chat")) {
        return createSseResponse([
          {
            type: "text_delta",
            text: "I filtered for large-cap funds with stronger 3-year returns."
          },
          {
            type: "tool_call",
            toolCall: {
              id: "toolu_apply",
              name: "apply_filters",
              input: {
                category: "Large Cap",
                min_returns_3y: 15,
                sort_by: "returns_3y"
              }
            }
          },
          {
            type: "done"
          }
        ]);
      }

      if (url.includes("/api/funds")) {
        return Response.json({
          ok: true,
          data: createFundsData(
            [sampleFund],
            {
              category: "Large Cap",
              min_returns_3y: 15,
              sort_by: "returns_3y",
              order: "desc"
            },
            null,
            [sampleCategoryBenchmark]
          )
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<MfScreenerApp />);
    fireEvent.click(
      screen.getByText("Show large-cap direct funds with 3Y returns >= 15% and Sharpe >= 1")
    );

    expect(await screen.findByText("Applied filters")).toBeInTheDocument();
    expect(screen.getByText("Category: Large Cap")).toBeInTheDocument();
    expect(screen.getByText("3Y returns >= 15.00%")).toBeInTheDocument();
    expect(await screen.findByText("Why these filters")).toBeInTheDocument();
    expect(await screen.findByText(/category narrows the universe/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(useFiltersStore.getState().filters).toMatchObject({
        category: "Large Cap",
        min_returns_3y: 15
      })
    );
    expect(
      await screen.findByRole("button", { name: "Refine filters: Direct plans only" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Refine filters: Expense <= 1%" })
    ).toBeInTheDocument();
    expect(await screen.findByText("HDFC Large Cap Direct Growth")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/chat"),
      expect.objectContaining({
        method: "POST"
      })
    );
  });

  it("sends visible result context with follow-up chat messages", async () => {
    useFiltersStore.getState().applyFilters({
      category: "Large Cap",
      order: "desc",
      sort_by: "returns_3y"
    });
    const chatBodies: Array<{
      uiContext?: ChatUiContext;
    }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/api/chat")) {
        chatBodies.push(JSON.parse(String(init?.body)) as { uiContext?: ChatUiContext });

        return createSseResponse([
          {
            type: "text_delta",
            text: "HDFC Large Cap Direct Growth is visible in the table. Its metrics come from the current UI context."
          },
          {
            type: "done"
          }
        ]);
      }

      if (url.includes("/api/funds")) {
        return Response.json({
          ok: true,
          data: createFundsData(
            [sampleFund],
            {
              category: "Large Cap",
              order: "desc",
              sort_by: "returns_3y"
            },
            null,
            [sampleCategoryBenchmark]
          )
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<MfScreenerApp />);

    expect(await screen.findByText("HDFC Large Cap Direct Growth")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Message"), {
      target: {
        value: "What is visible here?"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(chatBodies).toHaveLength(1));
    expect(chatBodies[0].uiContext?.results.visibleFunds[0]).toMatchObject({
      scheme_name: "HDFC Large Cap Direct Growth",
      returns_3y_vs_category: 1.4
    });
  });

  it("removes filter chips and clears all filters", () => {
    const removeFilter = vi.fn();
    const clearFilters = vi.fn();

    render(
      <FilterChips
        filters={{
          category: "Large Cap",
          min_returns_3y: 15
        }}
        onClearAll={clearFilters}
        onRemove={removeFilter}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Category: Large Cap/i }));
    expect(removeFilter).toHaveBeenCalledWith("category");

    fireEvent.click(screen.getByRole("button", { name: /Clear all/i }));
    expect(clearFilters).toHaveBeenCalled();
  });

  it("opens fund details in a drawer and keeps table sorting available after close", async () => {
    const onSortChange = vi.fn();

    render(
      <FundTable
        categoryBenchmarks={[sampleCategoryBenchmark]}
        funds={[sampleFund]}
        onSortChange={onSortChange}
      />
    );
    expect(screen.getByText("₹123.45")).toBeInTheDocument();
    expect(screen.getByText("₹15,000.00 Cr")).toBeInTheDocument();
    expect(screen.getByText("₹500")).toBeInTheDocument();
    expect(screen.getByText("Vs cat.")).toBeInTheDocument();
    expect(screen.getByText("+1.4%")).toBeInTheDocument();

    fireEvent.click(screen.getByText("HDFC Large Cap Direct Growth"));

    expect(
      screen.getByRole("dialog", {
        name: "HDFC Large Cap Direct Growth"
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Return snapshot")).toBeInTheDocument();
    expect(screen.getByText("Performance and risk")).toBeInTheDocument();
    expect(screen.getAllByText("Sharpe").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1.05").length).toBeGreaterThan(0);
    expect(screen.getByText("Vs category median")).toBeInTheDocument();
    expect(screen.getByText("Direct Large Cap peer median · 3 funds")).toBeInTheDocument();
    expect(screen.getByText("+0.10")).toBeInTheDocument();
    expect(screen.getByText("-0.1%")).toBeInTheDocument();
    expect(screen.getByText("1% if redeemed within 1 year")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", {
          name: "HDFC Large Cap Direct Growth"
        })
      ).not.toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: /^3Y\b/i }));
    expect(onSortChange).toHaveBeenCalledWith({
      sort_by: "returns_3y",
      order: "desc"
    });

    fireEvent.click(screen.getByRole("button", { name: /^Expense\b/i }));
    expect(onSortChange).toHaveBeenCalledWith({
      sort_by: "expense_ratio",
      order: "asc"
    });
  });

  it("renders a benchmark fallback when peer data is missing", () => {
    const onSortChange = vi.fn();

    render(<FundTable funds={[sampleFund]} onSortChange={onSortChange} />);

    expect(screen.getByText("Vs cat.")).toBeInTheDocument();
    expect(within(screen.getByTestId("fund-row")).getByText("-")).toBeInTheDocument();
  });

  it("renders a preview table for the empty first-run results state", () => {
    render(
      <FundResults
        fundsResult={{
          data: null,
          error: null,
          refetch: vi.fn(),
          setPage: vi.fn(),
          status: "idle"
        }}
        showSavedFilters={false}
      />
    );

    const previewTable = screen.getByRole("table", {
      name: "Fund results preview"
    });

    expect(screen.getByText("No fund screen yet")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Ask a question in chat or pick a saved filter to load matching mutual funds here."
      )
    ).toBeInTheDocument();
    for (const header of ["Fund", "Category", "AUM", "Expense", "3Y"]) {
      expect(within(previewTable).getByText(header)).toBeInTheDocument();
    }
    expect(screen.queryAllByTestId("fund-row")).toHaveLength(0);
  });

  it("renders pagination controls for paged fund results", () => {
    const setPage = vi.fn();
    useFiltersStore.getState().applyFilters({
      category: "Large Cap",
      limit: 1
    });

    render(
      <FundResults
        fundsResult={{
          data: {
            ...createFundsData([sampleFund], {
              category: "Large Cap",
              limit: 1
            }),
            page: 1,
            pageCount: 2,
            pageSize: 1,
            total: 2
          },
          error: null,
          refetch: vi.fn(),
          setPage,
          status: "success"
        }}
        showSavedFilters={false}
      />
    );

    expect(screen.getByText("1-1 of 2 funds")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(setPage).toHaveBeenCalledWith(2);
  });

  it("renders zero-state relaxation buttons that remove filters", () => {
    useFiltersStore.getState().applyFilters({
      min_returns_3y: 50,
      max_expense_ratio: 0.1
    });

    render(
      <FundResults
        fundsResult={{
          data: createFundsData([], {
            min_returns_3y: 50,
            max_expense_ratio: 0.1
          }, {
            reason: "no_matches",
            message: "No funds matched. Try relaxing the strictest filters.",
            suggestions: [
              {
                label: "Remove the 3-year return floor",
                removeFilter: "min_returns_3y"
              }
            ]
          }),
          error: null,
          refetch: vi.fn(),
          setPage: vi.fn(),
          status: "success"
        }}
        showSavedFilters={false}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove the 3-year return floor" }));

    expect(useFiltersStore.getState().filters).toEqual({
      max_expense_ratio: 0.1
    });
  });

  it("renders stable loading and error states for fund results", () => {
    useFiltersStore.getState().applyFilters({
      category: "Large Cap"
    });

    const retry = vi.fn();
    const { rerender } = render(
      <FundResults
        fundsResult={{
          data: null,
          error: null,
          refetch: retry,
          setPage: vi.fn(),
          status: "loading"
        }}
        showSavedFilters={false}
      />
    );

    expect(screen.getByRole("status", { name: "Loading funds" })).toBeInTheDocument();

    rerender(
      <FundResults
        fundsResult={{
          data: null,
          error: "Unable to load funds right now.",
          refetch: retry,
          setPage: vi.fn(),
          status: "error"
        }}
        showSavedFilters={false}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Unable to load funds right now.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalled();
  });

  it("removes advanced metric filters from zero-state suggestions", () => {
    useFiltersStore.getState().applyFilters({
      min_sharpe_ratio: 2,
      max_standard_deviation: 5
    });

    render(
      <FundResults
        fundsResult={{
          data: createFundsData([], {
            min_sharpe_ratio: 2,
            max_standard_deviation: 5
          }, {
            reason: "no_matches",
            message: "No funds matched. Try relaxing the strictest filters.",
            suggestions: [
              {
                label: "Lower the Sharpe ratio floor",
                removeFilter: "min_sharpe_ratio"
              }
            ]
          }),
          error: null,
          refetch: vi.fn(),
          setPage: vi.fn(),
          status: "success"
        }}
        showSavedFilters={false}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Lower the Sharpe ratio floor" }));

    expect(useFiltersStore.getState().filters).toEqual({
      max_standard_deviation: 5
    });
  });

  it("renders a helpful zero-result fallback when no relaxation suggestions exist", () => {
    useFiltersStore.getState().applyFilters({
      category: "Large Cap"
    });

    render(
      <FundResults
        fundsResult={{
          data: createFundsData([], {
            category: "Large Cap"
          }, {
            reason: "no_matches",
            message: "No funds matched. Try a broader screen.",
            suggestions: []
          }),
          error: null,
          refetch: vi.fn(),
          setPage: vi.fn(),
          status: "success"
        }}
        showSavedFilters={false}
      />
    );

    expect(screen.getByText("Try removing a filter or starting with a broader category.")).toBeInTheDocument();
  });

  it("sends magic links and signs out from the chat auth CTA", async () => {
    const signInWithOtp = vi.fn(async () => ({ error: null }));
    const signOut = vi.fn(async () => ({ error: null }));
    const supabase: AuthSupabaseClient = {
      auth: {
        getSession: async () => ({
          data: {
            session: null
          },
          error: null
        }),
        onAuthStateChange: () => ({
          data: {
            subscription: {
              unsubscribe: () => {}
            }
          }
        }),
        signInWithOtp,
        signOut
      }
    };

    render(<ChatAuthCta supabase={supabase} />);
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    fireEvent.change(screen.getByLabelText("Email"), {
      target: {
        value: "investor@example.com"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Send link" }));

    await waitFor(() =>
      expect(signInWithOtp).toHaveBeenCalledWith({
        email: "investor@example.com",
        options: {
          emailRedirectTo: getAuthCallbackUrl()
        }
      })
    );
    expect(await screen.findByText("Check your email for the sign-in link.")).toBeInTheDocument();

    const signedInSupabase: AuthSupabaseClient = {
      auth: {
        getSession: async () => ({
          data: {
            session: {
              user: {
                email: "investor@example.com"
              }
            }
          },
          error: null
        }),
        onAuthStateChange: () => ({
          data: {
            subscription: {
              unsubscribe: () => {}
            }
          }
        }),
        signInWithOtp,
        signOut
      }
    };

    render(<ChatAuthCta supabase={signedInSupabase} />);
    expect(await screen.findByText("investor@example.com")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(signOut).toHaveBeenCalled());
  });
});

const sampleFund: FundRow = {
  aum_cr: 15000,
  category: "Large Cap",
  exit_load: "1% if redeemed within 1 year",
  expense_ratio: 0.72,
  fund_house: "HDFC",
  min_sip: 500,
  nav: 123.45,
  plan_type: "Direct",
  rating: 5,
  returns_1y: 18.2,
  returns_3y: 16.4,
  returns_5y: 14.1,
  rolling_returns_3y: 15.9,
  sharpe_ratio: 1.05,
  standard_deviation: 12.7,
  beta: 0.92,
  upside_capture_ratio: 96.3,
  downside_capture_ratio: 84.8,
  scheme_code: "100001",
  scheme_name: "HDFC Large Cap Direct Growth",
  sub_category: "Large Cap Fund",
  updated_at: "2026-05-01T00:00:00.000Z"
};

const sampleCategoryBenchmark: CategoryBenchmark = {
  category: "Large Cap",
  expense_ratio: 0.82,
  fundCount: 3,
  plan_type: "Direct",
  returns_1y: 17,
  returns_3y: 15,
  returns_5y: 13.4,
  rolling_returns_3y: 14.8,
  sharpe_ratio: 0.95,
  standard_deviation: 13.1
};

function createFundsData(
  funds: FundRow[],
  filters: FundsQueryData["filters"],
  zeroState: FundsQueryData["zeroState"] = null,
  categoryBenchmarks: CategoryBenchmark[] = []
): FundsQueryData {
  return {
    categoryBenchmarks,
    funds,
    filters,
    page: 1,
    pageCount: funds.length > 0 ? 1 : 0,
    pageSize: 25,
    total: funds.length,
    zeroState
  };
}

function createSseResponse(events: Array<Record<string, unknown>>): Response {
  const encoder = new TextEncoder();
  const body = events
    .map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
    .join("");

  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(body));
        controller.close();
      }
    }),
    {
      headers: {
        "content-type": "text/event-stream"
      },
      status: 200
    }
  );
}
