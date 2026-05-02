import { readFile } from "node:fs/promises";
import path from "node:path";

export const AMFI_NAV_URL =
  process.env.AMFI_NAV_URL ?? "https://www.amfiindia.com/spages/NAVAll.txt";

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

  for (const navRecord of navRecords) {
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

export async function prepareFundRows({
  source = "sample",
  navText,
  fetchImpl,
  limitToEnriched = false
} = {}) {
  const resolvedNavText = navText ?? (await loadNavText({ source, fetchImpl }));
  const navRecords = parseAmfiNavText(resolvedNavText);
  const enrichmentRecords = await loadEnrichmentRecords();
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

export function summarizePreparedRows({ rows, skipped, navRecords, enrichmentRecords, enrichmentMatches }) {
  return {
    navRecords: navRecords.length,
    enrichmentRecords: enrichmentRecords.length,
    preparedRows: rows.length,
    skippedRows: skipped.length,
    enrichmentMatches
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
