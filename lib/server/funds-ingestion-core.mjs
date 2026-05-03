import { readFile } from "node:fs/promises";
import path from "node:path";

export const AMFI_NAV_URL =
  process.env.AMFI_NAV_URL ?? "https://www.amfiindia.com/spages/NAVAll.txt";
export const MF_DATA_API_BASE_URL =
  process.env.MF_DATA_API_BASE_URL ?? "https://mfdata.in/api/v1";

export const DEFAULT_AMFI_SAMPLE_PATH = path.join(process.cwd(), "data/amfi-nav.sample.txt");
export const DEFAULT_ENRICHMENT_PATH = path.join(process.cwd(), "data/enriched-funds.seed.json");

const VALID_PLAN_TYPES = new Set(["Direct", "Regular"]);
const VALID_CATEGORIES = new Set([
  "Large Cap",
  "Mid Cap",
  "Small Cap",
  "Flexi Cap",
  "ELSS",
  "Hybrid",
  "Debt",
  "Index",
  "Other"
]);

export async function loadTextFile(filePath) {
  return readFile(filePath, "utf8");
}

export async function loadJsonFile(filePath) {
  const raw = await loadTextFile(filePath);
  return JSON.parse(raw);
}

export async function fetchText(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    headers: {
      "User-Agent": "vesta-mfs-ingestion/1.0"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

export async function loadNavText({ source = "sample", url = AMFI_NAV_URL, fetchImpl } = {}) {
  if (source === "amfi") {
    return fetchText(url, fetchImpl);
  }

  if (source === "sample") {
    return loadTextFile(DEFAULT_AMFI_SAMPLE_PATH);
  }

  throw new Error(`Unknown NAV source: ${source}`);
}

export async function loadEnrichmentRecords(filePath = DEFAULT_ENRICHMENT_PATH) {
  const records = await loadJsonFile(filePath);
  return validateEnrichmentRecords(records);
}

export function parseAmfiNavText(text) {
  const records = [];
  let currentFundHouse = "Unknown";
  let currentCategory = "Other";
  let currentSubCategory = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.toLowerCase().startsWith("scheme code")) {
      continue;
    }

    if (!line.includes(";") && !line.includes("|")) {
      if (/schemes?/i.test(line)) {
        currentCategory = normalizeCategory(line);
        currentSubCategory = extractSubCategory(line);
      } else if (/mutual fund/i.test(line)) {
        currentFundHouse = line.replace(/\s+Mutual Fund$/i, "").trim();
      }
      continue;
    }

    const delimiter = line.includes(";") ? ";" : "|";
    const columns = line.split(delimiter).map((value) => value.trim());

    if (columns.length < 6) {
      continue;
    }

    const [schemeCode, isinGrowth, isinReinvestment, schemeName, navRaw, dateRaw] = columns;
    const nav = Number.parseFloat(navRaw);

    if (!schemeCode || !schemeName || !Number.isFinite(nav)) {
      continue;
    }

    records.push({
      scheme_code: schemeCode,
      isin_growth: isinGrowth || null,
      isin_div_reinvestment: isinReinvestment || null,
      scheme_name: schemeName,
      fund_house: currentFundHouse,
      category: currentCategory,
      sub_category: currentSubCategory,
      plan_type: inferPlanType(schemeName),
      nav,
      nav_date: parseAmfiDate(dateRaw)
    });
  }

  return records;
}

export function buildFundRows({ navRecords, enrichmentRecords, limitToEnriched = false }) {
  const enrichmentByCode = new Map(
    enrichmentRecords.map((record) => [String(record.scheme_code), record])
  );

  const rows = [];
  const skipped = [];

  for (const navRecord of dedupeNavRecordsBySchemeCode(navRecords)) {
    const enrichment = enrichmentByCode.get(String(navRecord.scheme_code));

    if (limitToEnriched && !enrichment) {
      skipped.push({
        scheme_code: navRecord.scheme_code,
        reason: "missing_enrichment"
      });
      continue;
    }

    const row = {
      scheme_code: String(navRecord.scheme_code),
      scheme_name: navRecord.scheme_name,
      fund_house: enrichment?.fund_house ?? navRecord.fund_house,
      category: enrichment?.category ?? navRecord.category,
      sub_category: enrichment?.sub_category ?? navRecord.sub_category,
      plan_type: enrichment?.plan_type ?? navRecord.plan_type,
      nav: navRecord.nav,
      aum_cr: enrichment?.aum_cr ?? null,
      expense_ratio: enrichment?.expense_ratio ?? null,
      returns_1y: enrichment?.returns_1y ?? null,
      returns_3y: enrichment?.returns_3y ?? null,
      returns_5y: enrichment?.returns_5y ?? null,
      rolling_returns_3y: enrichment?.rolling_returns_3y ?? null,
      sharpe_ratio: enrichment?.sharpe_ratio ?? null,
      standard_deviation: enrichment?.standard_deviation ?? null,
      beta: enrichment?.beta ?? null,
      upside_capture_ratio: enrichment?.upside_capture_ratio ?? null,
      downside_capture_ratio: enrichment?.downside_capture_ratio ?? null,
      rating: enrichment?.rating ?? null,
      min_sip: enrichment?.min_sip ?? null,
      exit_load: enrichment?.exit_load ?? null,
      updated_at: toUpdatedAt(navRecord.nav_date)
    };

    const validationError = validateFundRow(row);

    if (validationError) {
      skipped.push({
        scheme_code: navRecord.scheme_code,
        reason: validationError
      });
      continue;
    }

    rows.push(row);
  }

  return {
    rows,
    skipped,
    enrichmentMatches: rows.filter((row) => enrichmentByCode.has(row.scheme_code)).length
  };
}

function dedupeNavRecordsBySchemeCode(navRecords) {
  return Array.from(
    navRecords
      .reduce((recordsBySchemeCode, navRecord) => {
        recordsBySchemeCode.set(String(navRecord.scheme_code), navRecord);
        return recordsBySchemeCode;
      }, new Map())
      .values()
  );
}

export async function prepareFundRows({
  enrichmentSource = "fixture",
  source = "sample",
  navText,
  fetchImpl,
  limitToEnriched = false,
  mfDataFullDetails = false,
  mfDataDetailDelayMs = 2100,
  mfDataMaxDetails
} = {}) {
  const resolvedNavText = navText ?? (await loadNavText({ source, fetchImpl }));
  const navRecords = parseAmfiNavText(resolvedNavText);
  const enrichmentRecords =
    enrichmentSource === "mfdata"
      ? await loadMfDataEnrichmentRecords({
          delayMs: mfDataDetailDelayMs,
          fetchImpl,
          fullDetails: mfDataFullDetails,
          maxDetails: mfDataMaxDetails,
          navRecords
        })
      : await loadEnrichmentRecords();
  const result = buildFundRows({ navRecords, enrichmentRecords, limitToEnriched });

  return {
    ...result,
    navRecords,
    enrichmentRecords
  };
}

export async function upsertFunds(supabase, rows, { batchSize = 500 } = {}) {
  let batches = 0;

  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    const { error } = await supabase.from("funds").upsert(batch, {
      onConflict: "scheme_code"
    });

    if (error) {
      throw new Error(`Supabase funds upsert failed: ${error.message}`);
    }

    batches += 1;
  }

  return {
    batches,
    upserted: rows.length
  };
}

export function summarizePreparedRows({
  rows,
  skipped,
  navRecords,
  enrichmentRecords,
  enrichmentMatches
}) {
  return {
    navRecords: navRecords.length,
    enrichmentRecords: enrichmentRecords.length,
    preparedRows: rows.length,
    skippedRows: skipped.length,
    enrichmentMatches
  };
}

export async function loadMfDataEnrichmentRecords({
  delayMs = 2100,
  fetchImpl = fetch,
  fullDetails = false,
  maxDetails,
  navRecords
} = {}) {
  const schemes = await fetchMfDataSchemes({ fetchImpl });
  const schemeByCode = new Map(schemes.map((scheme) => [String(scheme.amfi_code), scheme]));
  const codes = navRecords
    .map((record) => String(record.scheme_code))
    .filter((code) => schemeByCode.has(code));
  const detailByCode = fullDetails
    ? await fetchMfDataCompareDetails({
        codes: maxDetails == null ? codes : codes.slice(0, maxDetails),
        delayMs,
        fetchImpl
      })
    : new Map();

  return codes.map((code) =>
    mapMfDataToEnrichmentRecord({
      detail: detailByCode.get(code),
      scheme: schemeByCode.get(code)
    })
  );
}

async function fetchMfDataSchemes({ fetchImpl, limit = 1000 } = {}) {
  const schemes = [];
  let offset = 0;

  while (true) {
    const url = new URL(`${MF_DATA_API_BASE_URL}/schemes`);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("exclude_fmp", "true");

    const body = await fetchMfDataJson(url, fetchImpl);
    const data = Array.isArray(body.data) ? body.data : [];
    schemes.push(...data);

    if (!body.meta?.has_next || data.length === 0) {
      return schemes;
    }

    offset += data.length;
  }
}

async function fetchMfDataCompareDetails({ codes, delayMs, fetchImpl }) {
  const details = new Map();
  const totalBatches = Math.ceil(codes.length / 10);

  for (let index = 0; index < codes.length; index += 10) {
    const batchNumber = Math.floor(index / 10) + 1;
    const batch = codes.slice(index, index + 10);
    const url = new URL(`${MF_DATA_API_BASE_URL}/compare`);
    url.searchParams.set("scheme_codes", batch.join(","));

    const body = await fetchMfDataJson(url, fetchImpl);
    const data = Array.isArray(body.data) ? body.data : [];

    for (const detail of data) {
      details.set(String(detail.amfi_code), detail);
    }

    if (totalBatches > 1 && (batchNumber === 1 || batchNumber % 50 === 0 || batchNumber === totalBatches)) {
      console.warn(
        `mfdata full enrichment: ${batchNumber}/${totalBatches} batches, ${details.size}/${codes.length} schemes`
      );
    }

    if (delayMs > 0 && index + 10 < codes.length) {
      await sleep(delayMs);
    }
  }

  return details;
}

async function fetchMfDataJson(url, fetchImpl) {
  const response = await fetchImpl(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "vesta-mfs-mfdata-enrichment/1.0"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const body = await response.json();

  if (body.status !== "success") {
    throw new Error(`mfdata.in returned an unsuccessful response for ${url}.`);
  }

  return body;
}

function mapMfDataToEnrichmentRecord({ detail, scheme }) {
  const source = detail ?? scheme;

  return {
    scheme_code: String(source.amfi_code),
    fund_house: normalizeFundHouse(source.amc_name),
    category: normalizeMfDataCategory(source.category),
    sub_category: source.category ?? null,
    plan_type: normalizeMfDataPlanType(source.plan_type),
    aum_cr: rupeesToCrores(source.aum),
    expense_ratio: toNullableNumber(source.expense_ratio),
    returns_1y: toNullableNumber(detail?.returns?.return_1y),
    returns_3y: toNullableNumber(detail?.returns?.return_3y),
    returns_5y: toNullableNumber(detail?.returns?.return_5y),
    rolling_returns_3y: null,
    sharpe_ratio: toNullableNumber(detail?.ratios?.returns?.sharpe_ratio),
    standard_deviation: toNullableNumber(detail?.ratios?.risk?.std_deviation),
    beta: toNullableNumber(detail?.ratios?.risk?.beta),
    upside_capture_ratio: null,
    downside_capture_ratio: null,
    rating: normalizeRating(source.morningstar),
    min_sip: normalizeInteger(detail?.min_sip),
    exit_load: normalizeExitLoad(detail?.exit_load)
  };
}

function validateEnrichmentRecords(records) {
  if (!Array.isArray(records)) {
    throw new Error("Enrichment data must be an array.");
  }

  return records.map((record, index) => {
    const schemeCode = String(record.scheme_code ?? "").trim();

    if (!schemeCode) {
      throw new Error(`Enrichment record at index ${index} is missing scheme_code.`);
    }

    if (!VALID_CATEGORIES.has(record.category)) {
      throw new Error(`Enrichment record ${schemeCode} has unsupported category ${record.category}.`);
    }

    if (!VALID_PLAN_TYPES.has(record.plan_type)) {
      throw new Error(`Enrichment record ${schemeCode} has unsupported plan_type ${record.plan_type}.`);
    }

    if (record.rating != null && (!Number.isInteger(record.rating) || record.rating < 1 || record.rating > 5)) {
      throw new Error(`Enrichment record ${schemeCode} has invalid rating ${record.rating}.`);
    }

    return {
      ...record,
      scheme_code: schemeCode
    };
  });
}

function validateFundRow(row) {
  if (!row.scheme_code) {
    return "missing_scheme_code";
  }

  if (!row.scheme_name) {
    return "missing_scheme_name";
  }

  if (!row.fund_house) {
    return "missing_fund_house";
  }

  if (!VALID_CATEGORIES.has(row.category)) {
    return "invalid_category";
  }

  if (!VALID_PLAN_TYPES.has(row.plan_type)) {
    return "invalid_plan_type";
  }

  if (!Number.isFinite(row.nav)) {
    return "invalid_nav";
  }

  if (!row.updated_at) {
    return "missing_updated_at";
  }

  return null;
}

function inferPlanType(schemeName) {
  if (/\bdirect\b/i.test(schemeName)) {
    return "Direct";
  }

  return "Regular";
}

function normalizeCategory(value) {
  const lower = value.toLowerCase();

  if (lower.includes("large cap")) {
    return "Large Cap";
  }

  if (lower.includes("mid cap")) {
    return "Mid Cap";
  }

  if (lower.includes("small cap")) {
    return "Small Cap";
  }

  if (lower.includes("flexi cap") || lower.includes("multi cap")) {
    return "Flexi Cap";
  }

  if (lower.includes("elss") || lower.includes("tax")) {
    return "ELSS";
  }

  if (lower.includes("hybrid")) {
    return "Hybrid";
  }

  if (lower.includes("debt") || lower.includes("income") || lower.includes("bond")) {
    return "Debt";
  }

  if (lower.includes("index") || lower.includes("etf")) {
    return "Index";
  }

  return "Other";
}

function normalizeMfDataCategory(value) {
  const normalized = String(value ?? "").toLowerCase().replace(/-/g, " ");

  if (normalized.includes("large cap")) {
    return "Large Cap";
  }

  if (normalized.includes("mid cap")) {
    return "Mid Cap";
  }

  if (normalized.includes("small cap")) {
    return "Small Cap";
  }

  if (
    normalized.includes("flexi cap") ||
    normalized.includes("multi cap") ||
    normalized.includes("focused")
  ) {
    return "Flexi Cap";
  }

  if (normalized.includes("elss") || normalized.includes("tax")) {
    return "ELSS";
  }

  if (normalized.includes("hybrid") || normalized.includes("balanced")) {
    return "Hybrid";
  }

  if (
    normalized.includes("debt") ||
    normalized.includes("bond") ||
    normalized.includes("liquid") ||
    normalized.includes("gilt") ||
    normalized.includes("duration") ||
    normalized.includes("money market") ||
    normalized.includes("overnight")
  ) {
    return "Debt";
  }

  if (normalized.includes("index") || normalized.includes("etf") || normalized.includes("fund of fund")) {
    return "Index";
  }

  return "Other";
}

function normalizeMfDataPlanType(value) {
  return String(value ?? "").toLowerCase() === "direct" ? "Direct" : "Regular";
}

function normalizeFundHouse(value) {
  return String(value ?? "Unknown")
    .replace(/\s+Mutual Fund$/i, "")
    .trim();
}

function rupeesToCrores(value) {
  const number = toNullableNumber(value);
  return number == null ? null : roundTo(number / 10000000, 2);
}

function normalizeRating(value) {
  const number = Number(value);

  if (!Number.isInteger(number) || number < 1 || number > 5) {
    return null;
  }

  return number;
}

function normalizeInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : null;
}

function normalizeExitLoad(value) {
  const text = String(value ?? "")
    .replace(/<br\s*\/?>/gi, "; ")
    .replace(/\s+/g, " ")
    .trim();

  return text || null;
}

function toNullableNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function roundTo(value, decimals) {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function extractSubCategory(value) {
  const match = value.match(/\(([^)]+)\)/);
  return match?.[1]?.trim() ?? null;
}

function parseAmfiDate(value) {
  const trimmed = String(value ?? "").trim();
  const match = trimmed.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);

  if (!match) {
    return null;
  }

  const [, day, monthLabel, year] = match;
  const monthIndex = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11
  }[monthLabel.toLowerCase()];

  if (monthIndex == null) {
    return null;
  }

  const date = new Date(Date.UTC(Number(year), monthIndex, Number(day), 0, 0, 0));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toUpdatedAt(navDate) {
  return navDate ?? new Date().toISOString();
}
