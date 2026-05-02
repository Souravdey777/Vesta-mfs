import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const { Client } = pg;

async function main() {
  const databaseUrl = process.env.SUPABASE_DB_URL;

  if (!databaseUrl) {
    throw new Error("SUPABASE_DB_URL is required.");
  }

  const migrationsDir = path.join(process.cwd(), "supabase/migrations");
  const migrationFiles = (await readdir(migrationsDir))
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();

  if (migrationFiles.length === 0) {
    throw new Error("No SQL migrations found in supabase/migrations.");
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });

  await client.connect();

  try {
    for (const fileName of migrationFiles) {
      const sql = await readFile(path.join(migrationsDir, fileName), "utf8");
      await client.query(sql);
      console.log(`Applied ${fileName}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
