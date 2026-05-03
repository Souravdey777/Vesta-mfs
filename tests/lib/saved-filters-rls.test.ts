import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/001_create_funds_and_saved_filters.sql"
);

describe("saved filters RLS migration", () => {
  it("enables RLS and constrains every saved_filters policy to the authenticated user", async () => {
    const migration = await readFile(MIGRATION_PATH, "utf8");

    expect(normalizeSql(migration)).toContain(
      "alter table public.saved_filters enable row level security"
    );

    expect(getPolicySql(migration, "Users can read their saved filters")).toMatch(
      /for select\s+using\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/i
    );
    expect(getPolicySql(migration, "Users can insert their saved filters")).toMatch(
      /for insert\s+with check\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/i
    );
    expect(getPolicySql(migration, "Users can update their saved filters")).toMatch(
      /for update\s+using\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)\s+with check\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/i
    );
    expect(getPolicySql(migration, "Users can delete their saved filters")).toMatch(
      /for delete\s+using\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/i
    );
  });
});

function getPolicySql(migration: string, policyName: string): string {
  const pattern = new RegExp(
    `create policy "${escapeRegExp(policyName)}"\\s+on public\\.saved_filters\\s+([\\s\\S]*?);`,
    "i"
  );
  const match = migration.match(pattern);

  if (!match?.[0]) {
    throw new Error(`Missing saved_filters policy: ${policyName}`);
  }

  return normalizeSql(match[0]);
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim().toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
