import { getAuthCallbackResponse } from "@/lib/server/auth-callback";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return getAuthCallbackResponse(request);
}
