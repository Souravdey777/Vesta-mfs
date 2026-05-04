import { expect, test, type Page } from "@playwright/test";

const sampleFund = {
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

const sampleCategoryBenchmark = {
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

test.beforeEach(async ({ page }) => {
  await page.route("**/api/chat", async (route) => {
    await route.fulfill({
      body: [
        'event: text_delta\ndata: {"type":"text_delta","text":"I filtered for the top large-cap funds with 3-year returns above 15%."}',
        'event: tool_call\ndata: {"type":"tool_call","toolCall":{"id":"toolu_apply","name":"apply_filters","input":{"category":"Large Cap","limit":5,"min_returns_3y":15,"sort_by":"returns_3y"}}}',
        'event: done\ndata: {"type":"done"}'
      ].join("\n\n"),
      contentType: "text/event-stream",
      status: 200
    });
  });

  await page.route("**/api/funds?**", async (route) => {
    const url = new URL(route.request().url());
    const category = url.searchParams.get("category");
    const limit = Number(url.searchParams.get("limit") ?? 0);
    const minReturns = Number(url.searchParams.get("min_returns_3y") ?? 0);
    const pageSize = Number(url.searchParams.get("pageSize") ?? 25);
    const funds = category === "Large Cap" && minReturns <= 15 ? [sampleFund] : [];

    await route.fulfill({
      contentType: "application/json",
      status: 200,
      body: JSON.stringify({
        ok: true,
        data: {
          categoryBenchmarks: funds.length > 0 ? [sampleCategoryBenchmark] : [],
          funds,
          filters: {
            category,
            limit: limit || undefined,
            min_returns_3y: minReturns,
            order: "desc",
            sort_by: "returns_3y"
          },
          page: 1,
          pageCount: funds.length > 0 ? 1 : 0,
          pageSize,
          total: funds.length,
          zeroState: null
        }
      })
    });
  });
});

test("screens large-cap funds from chat and updates the table", async ({ page }) => {
  await page.goto("/");
  const limitedFundsRequest = page.waitForRequest((request) => {
    if (!request.url().includes("/api/funds?")) {
      return false;
    }

    const url = new URL(request.url());

    return url.searchParams.get("limit") === "5" && url.searchParams.get("pageSize") === "5";
  });

  await sendChatMessage(page, "top 5 large cap funds with >15% 3-year returns");
  await limitedFundsRequest;

  await expect(page.getByText("Category: Large Cap")).toBeVisible();
  await expect(page.locator("button").filter({ hasText: /^Top 5$/ })).toBeVisible();
  await expect(page.getByText("3Y returns >= 15.00%")).toBeVisible();
  await expect(page.getByText("HDFC Large Cap Direct Growth")).toBeVisible();
  await expect(page.getByTestId("fund-row")).toContainText("₹15,000.00 Cr");
  await expect(page.getByTestId("fund-row")).toContainText("16.40%");
  await expect(page.getByTestId("fund-row")).toContainText("+1.4%");
  await expect(page.getByTestId("fund-row")).toContainText("₹500");

  await page.getByRole("button", { name: /^AUM$/ }).hover();
  await expect(
    page.locator('[role="tooltip"]').filter({ hasText: "Assets under management, shown in crores." })
  ).toBeVisible();

  await page.getByText("HDFC Large Cap Direct Growth").click();
  await page.getByRole("dialog").getByText("AUM").hover();
  await expect(
    page.locator('[role="tooltip"]').filter({ hasText: "Assets under management, shown in crores." }).last()
  ).toBeVisible();
});

test("mobile chat can switch to filtered results", async ({ page }) => {
  await page.setViewportSize({
    height: 800,
    width: 390
  });
  await page.goto("/");
  await sendChatMessage(page, "top 5 large cap funds with >15% 3-year returns");

  await expect(page.getByRole("button", { name: "Show results" })).toBeVisible();
  await page.getByRole("button", { name: "Show results" }).click();
  await expect(page.locator("button").filter({ hasText: /^Top 5$/ })).toBeVisible();
  await expect(page.getByText("HDFC Large Cap Direct Growth")).toBeVisible();
});

async function sendChatMessage(page: Page, message: string) {
  const input = page.getByLabel("Message");
  const sendButton = page.getByRole("button", { name: "Send" });

  await expect(input).toBeVisible();
  await expect(input).toBeEnabled();
  await expect(sendButton).toBeEnabled();
  await input.click();
  await page.keyboard.type(message);
  await sendButton.click();
}
