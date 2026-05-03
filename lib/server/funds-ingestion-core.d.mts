export const AMFI_NAV_URL: string;
export const MF_DATA_API_BASE_URL: string;
export const DEFAULT_AMFI_SAMPLE_PATH: string;
export const DEFAULT_ENRICHMENT_PATH: string;

export type PlanType = "Direct" | "Regular";

export type FundCategory =
  | "Large Cap"
  | "Mid Cap"
  | "Small Cap"
  | "Flexi Cap"
  | "ELSS"
  | "Hybrid"
  | "Debt"
  | "Index"
  | "Other";

export type AmfiNavRecord = {
  scheme_code: string;
  isin_growth: string | null;
  isin_div_reinvestment: string | null;
  scheme_name: string;
  fund_house: string;
  category: FundCategory;
  sub_category: string | null;
  plan_type: PlanType;
  nav: number;
  nav_date: string | null;
};

export type EnrichmentRecord = {
  scheme_code: string;
  fund_house: string;
  category: FundCategory;
  sub_category: string | null;
  plan_type: PlanType;
  aum_cr: number | null;
  expense_ratio: number | null;
  returns_1y: number | null;
  returns_3y: number | null;
  returns_5y: number | null;
  rolling_returns_3y: number | null;
  sharpe_ratio: number | null;
  standard_deviation: number | null;
  beta: number | null;
  upside_capture_ratio: number | null;
  downside_capture_ratio: number | null;
  rating: 1 | 2 | 3 | 4 | 5 | null;
  min_sip: number | null;
  exit_load: string | null;
};

export type FundUpsertRow = {
  scheme_code: string;
  scheme_name: string;
  fund_house: string;
  category: FundCategory;
  sub_category: string | null;
  plan_type: PlanType;
  nav: number;
  aum_cr: number | null;
  expense_ratio: number | null;
  returns_1y: number | null;
  returns_3y: number | null;
  returns_5y: number | null;
  rolling_returns_3y: number | null;
  sharpe_ratio: number | null;
  standard_deviation: number | null;
  beta: number | null;
  upside_capture_ratio: number | null;
  downside_capture_ratio: number | null;
  rating: 1 | 2 | 3 | 4 | 5 | null;
  min_sip: number | null;
  exit_load: string | null;
  updated_at: string;
};

export type PreparedFundRows = {
  rows: FundUpsertRow[];
  skipped: Array<{ scheme_code: string; reason: string }>;
  navRecords: AmfiNavRecord[];
  enrichmentRecords: EnrichmentRecord[];
  enrichmentMatches: number;
};

export function loadTextFile(filePath: string): Promise<string>;
export function loadJsonFile(filePath: string): Promise<unknown>;
export function fetchText(url: string, fetchImpl?: typeof fetch): Promise<string>;
export function loadNavText(options?: {
  source?: "sample" | "amfi";
  url?: string;
  fetchImpl?: typeof fetch;
}): Promise<string>;
export function loadEnrichmentRecords(filePath?: string): Promise<EnrichmentRecord[]>;
export function parseAmfiNavText(text: string): AmfiNavRecord[];
export function buildFundRows(options: {
  navRecords: AmfiNavRecord[];
  enrichmentRecords: EnrichmentRecord[];
  limitToEnriched?: boolean;
}): Pick<PreparedFundRows, "rows" | "skipped" | "enrichmentMatches">;
export function prepareFundRows(options?: {
  enrichmentSource?: "fixture" | "mfdata";
  source?: "sample" | "amfi";
  navText?: string;
  fetchImpl?: typeof fetch;
  limitToEnriched?: boolean;
  mfDataFullDetails?: boolean;
  mfDataDetailDelayMs?: number;
  mfDataMaxDetails?: number;
}): Promise<PreparedFundRows>;
export function loadMfDataEnrichmentRecords(options?: {
  delayMs?: number;
  fetchImpl?: typeof fetch;
  fullDetails?: boolean;
  maxDetails?: number;
  navRecords: AmfiNavRecord[];
}): Promise<EnrichmentRecord[]>;
export function upsertFunds(
  supabase: unknown,
  rows: FundUpsertRow[],
  options?: { batchSize?: number }
): Promise<{ batches: number; upserted: number }>;
export function summarizePreparedRows(prepared: PreparedFundRows): {
  navRecords: number;
  enrichmentRecords: number;
  preparedRows: number;
  skippedRows: number;
  enrichmentMatches: number;
};
