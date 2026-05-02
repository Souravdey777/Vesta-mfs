import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GET } from "@/app/api/cron/refresh-funds/route";

const ORIGINAL_ENV = process.env;

describe("refresh funds cron route", () => {
  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      CRON_SECRET: "test-cron-secret"
    };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("rejects requests without the cron secret", async () => {
    const response = await GET(new Request("http://localhost/api/cron/refresh-funds"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      ok: false,
      error: "Unauthorized cron request."
    });
  });

  it("returns parsed row counts for an authorized dry run", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/refresh-funds?dryRun=1&source=sample", {
        headers: {
          authorization: "Bearer test-cron-secret"
        }
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      dryRun: true,
      source: "sample"
    });
    expect(body.summary.preparedRows).toBeGreaterThan(0);
    expect(body.summary.skippedRows).toBe(0);
  });
});
