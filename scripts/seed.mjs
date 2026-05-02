import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

import {
  prepareFundRows,
  summarizePreparedRows,
  upsertFunds
} from "../lib/server/funds-ingestion-core.mjs";

async function main() {
  loadEnvFiles();

  const options = parseArgs(process.argv.slice(2));
  const source = options.source ?? (options.dryRun ? "sample" : "amfi");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!options.dryRun && (!supabaseUrl || !serviceRoleKey)) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them in .env.local before running npm run seed."
    );
  }

  const prepared = await prepareFundRows({
    source,
    limitToEnriched: options.limitToEnriched
  });
  const summary = summarizePreparedRows(prepared);

  console.log(JSON.stringify({ dryRun: options.dryRun, source, summary }, null, 2));

  if (prepared.skipped.length > 0) {
    console.warn(`Skipped ${prepared.skipped.length} rows.`);
    console.warn(JSON.stringify(prepared.skipped.slice(0, 10), null, 2));
  }

  if (options.dryRun) {
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false
    }
  });
  const writeResult = await upsertFunds(supabase, prepared.rows);

  console.log(JSON.stringify({ writeResult }, null, 2));
}

function parseArgs(args) {
  const sourceArg = args.find((arg) => arg.startsWith("--source="));
  const source = sourceArg?.split("=")[1];

  if (source != null && source !== "sample" && source !== "amfi") {
    throw new Error(`Unsupported source "${source}". Use --source=sample or --source=amfi.`);
  }

  return {
    dryRun: args.includes("--dry-run"),
    limitToEnriched: args.includes("--limit-to-enriched"),
    source
  };
}

function loadEnvFiles() {
  const loaded = {};

  for (const fileName of [".env", ".env.local"]) {
    const filePath = path.join(process.cwd(), fileName);

    if (!existsSync(filePath)) {
      continue;
    }

    Object.assign(loaded, parseEnvFile(readFileSync(filePath, "utf8")));
  }

  for (const [key, value] of Object.entries(loaded)) {
    if (process.env[key] == null) {
      process.env[key] = value;
    }
  }
}

function parseEnvFile(contents) {
  const env = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");

    if (key) {
      env[key] = value;
    }
  }

  return env;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
