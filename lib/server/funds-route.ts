import { NextResponse } from "next/server";

import {
  createFundsSupabaseClient,
  parseFundsQuery,
  queryFunds,
  type FundsSupabaseClient
} from "@/lib/server/funds-query";

type FundsRouteOptions = {
  supabase?: FundsSupabaseClient;
  logger?: Pick<Console, "error">;
};

export async function getFundsResponse(request: Request, options: FundsRouteOptions = {}) {
  const url = new URL(request.url);
  const parsed = parseFundsQuery(url.searchParams);

  if (!parsed.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid funds query.",
        issues: parsed.issues
      },
      { status: 400 }
    );
  }

  try {
    const supabase = options.supabase ?? createFundsSupabaseClient();
    const data = await queryFunds(supabase, parsed.params);

    return NextResponse.json({
      ok: true,
      data
    });
  } catch (error) {
    const logger = options.logger ?? console;
    logger.error("Funds query failed", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Unable to load funds right now."
      },
      { status: 500 }
    );
  }
}
