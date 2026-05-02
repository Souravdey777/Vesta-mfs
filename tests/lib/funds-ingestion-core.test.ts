import { describe, expect, it } from "vitest";

import {
  buildFundRows,
  loadEnrichmentRecords,
  loadNavText,
  parseAmfiNavText,
  prepareFundRows
} from "@/lib/server/funds-ingestion-core.mjs";

describe("funds ingestion core", () => {
  it("parses AMFI NAV sample records", async () => {
    const navText = await loadNavText({ source: "sample" });
    const records = parseAmfiNavText(navText);

    expect(records).toHaveLength(10);
    expect(records[0]).toMatchObject({
      scheme_code: "125497",
      fund_house: "HDFC",
      category: "Large Cap",
      plan_type: "Direct",
      nav: 942.456
    });
  });

  it("merges NAV records with enrichment data into fund upsert rows", async () => {
    const navText = await loadNavText({ source: "sample" });
    const navRecords = parseAmfiNavText(navText);
    const enrichmentRecords = await loadEnrichmentRecords();
    const result = buildFundRows({ navRecords, enrichmentRecords });

    expect(result.rows).toHaveLength(10);
    expect(result.skipped).toHaveLength(0);
    expect(result.enrichmentMatches).toBe(10);
    expect(result.rows[0]).toMatchObject({
      scheme_code: "125497",
      category: "Large Cap",
      aum_cr: 35620.5,
      expense_ratio: 0.91,
      returns_3y: 17.4,
      rating: 4
    });
  });

  it("prepares a dry-run summary without Supabase credentials", async () => {
    const prepared = await prepareFundRows({ source: "sample" });

    expect(prepared.rows.length).toBeGreaterThan(0);
    expect(prepared.enrichmentMatches).toBe(prepared.rows.length);
  });
});
