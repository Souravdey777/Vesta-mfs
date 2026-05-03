import { describe, expect, it } from "vitest";

import {
  buildFundRows,
  loadEnrichmentRecords,
  loadMfDataEnrichmentRecords,
  loadNavText,
  parseAmfiNavText,
  prepareFundRows,
  upsertFunds,
  type AmfiNavRecord,
  type FundUpsertRow
} from "@/lib/server/funds-ingestion-core.mjs";

describe("funds ingestion core", () => {
  it("parses AMFI NAV sample records", async () => {
    const navText = await loadNavText({ source: "sample" });
    const records = parseAmfiNavText(navText);

    expect(records).toHaveLength(28);
    expect(records[0]).toMatchObject({
      scheme_code: "125497",
      fund_house: "HDFC",
      category: "Large Cap" as const,
      plan_type: "Direct" as const,
      nav: 942.456
    });
  });

  it("merges NAV records with enrichment data into fund upsert rows", async () => {
    const navText = await loadNavText({ source: "sample" });
    const navRecords = parseAmfiNavText(navText);
    const enrichmentRecords = await loadEnrichmentRecords();
    const result = buildFundRows({ navRecords, enrichmentRecords });

    expect(result.rows).toHaveLength(28);
    expect(result.skipped).toHaveLength(0);
    expect(result.enrichmentMatches).toBe(28);
    expect(result.rows[0]).toMatchObject({
      scheme_code: "125497",
      category: "Large Cap" as const,
      aum_cr: 35620.5,
      expense_ratio: 0.91,
      returns_3y: 17.4,
      rolling_returns_3y: 16.8,
      sharpe_ratio: 1.04,
      standard_deviation: 13.7,
      rating: 4
    });
  });

  it("prepares a dry-run summary without Supabase credentials", async () => {
    const prepared = await prepareFundRows({ source: "sample" });
    const schemeCodes = prepared.rows.map((row) => row.scheme_code);

    expect(prepared.rows.length).toBeGreaterThan(0);
    expect(prepared.enrichmentMatches).toBe(prepared.rows.length);
    expect(new Set(schemeCodes).size).toBe(schemeCodes.length);
  });

  it("deduplicates repeated NAV scheme codes before seed upsert rows are produced", () => {
    const result = buildFundRows({
      enrichmentRecords: [],
      navRecords: [
        createNavRecord({
          nav: 10.25,
          scheme_name: "Example Fund - Direct Plan - Growth"
        }),
        createNavRecord({
          nav: 11.5,
          scheme_name: "Example Fund - Direct Plan - Growth Updated"
        })
      ]
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      scheme_code: "123456",
      scheme_name: "Example Fund - Direct Plan - Growth Updated",
      nav: 11.5
    });
  });

  it("uses scheme_code as the Supabase upsert conflict target", async () => {
    const upserts: Array<{ options: { onConflict?: string }; rows: unknown[] }> = [];
    const supabase = {
      from: (table: string) => {
        expect(table).toBe("funds");

        return {
          upsert: async (rows: unknown[], options: { onConflict?: string }) => {
            upserts.push({ rows, options });
            return { error: null };
          }
        };
      }
    };

    await upsertFunds(supabase, [createFundUpsertRow()], { batchSize: 500 });

    expect(upserts).toEqual([
      {
        rows: [createFundUpsertRow()],
        options: {
          onConflict: "scheme_code"
        }
      }
    ]);
  });

  it("maps actual mfdata.in enrichment without inventing unavailable metrics", async () => {
    const records = await loadMfDataEnrichmentRecords({
      delayMs: 0,
      fetchImpl: createMfDataFetch(),
      fullDetails: true,
      navRecords: [
        {
          category: "Flexi Cap",
          fund_house: "Parag Parikh",
          isin_div_reinvestment: null,
          isin_growth: null,
          nav: 91.4,
          nav_date: "2026-05-02T00:00:00.000Z",
          plan_type: "Direct",
          scheme_code: "122639",
          scheme_name: "Parag Parikh Flexi Cap Fund - Direct Plan - Growth",
          sub_category: "Flexi Cap Fund"
        }
      ]
    });

    expect(records).toEqual([
      {
        aum_cr: 134253.17,
        beta: 0.6,
        category: "Flexi Cap",
        downside_capture_ratio: null,
        exit_load: "0 - 365 Days : 2.0 %; 365 - 730 Days : 1.0 %",
        expense_ratio: 0.63,
        fund_house: "PPFAS",
        min_sip: 1000,
        plan_type: "Direct",
        rating: 5,
        returns_1y: 4.63,
        returns_3y: 17.59,
        returns_5y: 16.45,
        rolling_returns_3y: null,
        scheme_code: "122639",
        sharpe_ratio: -0.6,
        standard_deviation: 9.7,
        sub_category: "Flexi Cap",
        upside_capture_ratio: null
      }
    ]);
  });
});

function createMfDataFetch(): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));

    if (url.pathname === "/api/v1/schemes") {
      return Response.json({
        status: "success",
        data: [
          {
            amfi_code: "122639",
            amc_name: "PPFAS Mutual Fund",
            aum: 1342531700000,
            category: "Flexi Cap",
            expense_ratio: 0.63,
            morningstar: 5,
            plan_type: "direct"
          }
        ],
        meta: {
          has_next: false
        }
      });
    }

    if (url.pathname === "/api/v1/compare") {
      return Response.json({
        status: "success",
        data: [
          {
            amfi_code: "122639",
            amc_name: "PPFAS Mutual Fund",
            aum: 1342531700000,
            category: "Flexi Cap",
            exit_load: "0 - 365 Days : 2.0 %<br/>365 - 730 Days : 1.0 %",
            expense_ratio: 0.63,
            min_sip: 1000,
            morningstar: 5,
            plan_type: "direct",
            ratios: {
              returns: {
                sharpe_ratio: -0.6
              },
              risk: {
                beta: 0.6,
                std_deviation: 9.7
              }
            },
            returns: {
              return_1y: 4.63,
              return_3y: 17.59,
              return_5y: 16.45
            }
          }
        ]
      });
    }

    return Response.json({ status: "error" }, { status: 404 });
  }) as typeof fetch;
}

function createNavRecord(overrides: Partial<AmfiNavRecord> = {}): AmfiNavRecord {
  return {
    category: "Large Cap",
    fund_house: "Example",
    isin_div_reinvestment: null,
    isin_growth: null,
    nav: 10.25,
    nav_date: "2026-05-01T00:00:00.000Z",
    plan_type: "Direct",
    scheme_code: "123456",
    scheme_name: "Example Fund - Direct Plan - Growth",
    sub_category: "Large Cap Fund",
    ...overrides
  };
}

function createFundUpsertRow(): FundUpsertRow {
  return {
    aum_cr: null,
    beta: null,
    category: "Large Cap",
    downside_capture_ratio: null,
    exit_load: null,
    expense_ratio: null,
    fund_house: "Example",
    min_sip: null,
    nav: 10.25,
    plan_type: "Direct",
    rating: null,
    returns_1y: null,
    returns_3y: null,
    returns_5y: null,
    rolling_returns_3y: null,
    scheme_code: "123456",
    scheme_name: "Example Fund - Direct Plan - Growth",
    sharpe_ratio: null,
    standard_deviation: null,
    sub_category: "Large Cap Fund",
    updated_at: "2026-05-01T00:00:00.000Z",
    upside_capture_ratio: null
  };
}
