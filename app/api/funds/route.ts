import { getFundsResponse } from "@/lib/server/funds-route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return getFundsResponse(request);
}
