import { expect, test } from "@playwright/test";

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
  scheme_code: "100001",
  scheme_name: "HDFC Large Cap Direct Growth",
  sub_category: "Large Cap Fund",
  updated_at: "2026-05-01T00:00:00.000Z"
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/chat", async (route) => {
    await route.fulfill({
      body: [
        'event: text_delta\ndata: {"type":"text_delta","text":"I filtered for large-cap funds with 3-year returns above 15%."}',
        'event: tool_call\ndata: {"type":"tool_call","toolCall":{"id":"toolu_apply","name":"apply_filters","input":{"category":"Large Cap","min_returns_3y":15,"sort_by":"returns_3y"}}}',
        'event: done\ndata: {"type":"done"}'
      ].join("\n\n"),
      contentType: "text/event-stream",
      status: 200
    });
  });

  await page.route("**/api/funds?**", async (route) => {
    const url = new URL(route.request().url());
    const category = url.searchParams.get("category");
    const minReturns = Number(url.searchParams.get("min_returns_3y") ?? 0);
    const funds = category === "Large Cap" && minReturns <= 15 ? [sampleFund] : [];

    await route.fulfill({
      contentType: "application/json",
      status: 200,
      body: JSON.stringify({
        ok: true,
        data: {
          funds,
          filters: {
            category,
            min_returns_3y: minReturns,
            order: "desc",
            sort_by: "returns_3y"
          },
          page: 1,
          pageCount: funds.length > 0 ? 1 : 0,
          pageSize: 25,
          total: funds.length,
          zeroState: null
        }
      })
    });
  });
});

test("screens large-cap funds from chat and updates the table", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Message").fill("large cap funds with >15% 3-year returns");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("Category: Large Cap")).toBeVisible();
  await expect(page.getByText("3Y returns >= 15.00%")).toBeVisible();
  await expect(page.getByText("HDFC Large Cap Direct Growth")).toBeVisible();
  await expect(page.getByTestId("fund-row")).toContainText("16.40%");
});

test("mobile chat can switch to filtered results", async ({ page }) => {
  await page.setViewportSize({
    height: 800,
    width: 390
  });
  await page.goto("/");
  await page.getByText("Large cap funds with >15% 3-year returns").click();

  await expect(page.getByRole("button", { name: "Show results" })).toBeVisible();
  await page.getByRole("button", { name: "Show results" }).click();
  await expect(page.getByText("HDFC Large Cap Direct Growth")).toBeVisible();
});
