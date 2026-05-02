import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import {
  prepareFundRows,
  summarizePreparedRows,
  upsertFunds
} from "@/lib/server/funds-ingestion-core.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const unauthorized = authorizeCronRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const source = url.searchParams.get("source") === "sample" ? "sample" : "amfi";
  const prepared = await prepareFundRows({ source });
  const summary = summarizePreparedRows(prepared);

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      source,
      summary
    });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "Supabase service env vars are missing."
      },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false
    }
  });

  const writeResult = await upsertFunds(supabase, prepared.rows);

  return NextResponse.json({
    ok: true,
    dryRun: false,
    source,
    summary,
    writeResult
  });
}

function authorizeCronRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      {
        ok: false,
        error: "CRON_SECRET is not configured."
      },
      { status: 500 }
    );
  }

  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : null;

  if (token !== cronSecret) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized cron request."
      },
      { status: 401 }
    );
  }

  return null;
}
