import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type AuthExchangeClient = {
  auth: {
    exchangeCodeForSession(code: string): Promise<{
      error: { message: string } | null;
    }>;
  };
};

type AuthCallbackOptions = {
  authClient?: AuthExchangeClient;
  logger?: Pick<Console, "error">;
};

export async function getAuthCallbackResponse(
  request: Request,
  options: AuthCallbackOptions = {}
) {
  const response = NextResponse.redirect(new URL("/", request.url));
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return response;
  }

  try {
    const authClient = options.authClient ?? createRouteHandlerSupabaseClient(response);
    const { error } = await authClient.auth.exchangeCodeForSession(code);

    if (error) {
      (options.logger ?? console).error("Supabase auth callback failed", error);
    }
  } catch (error) {
    (options.logger ?? console).error("Supabase auth callback failed", error);
  }

  return response;
}

function createRouteHandlerSupabaseClient(response: NextResponse): AuthExchangeClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing browser Supabase environment variables.");
  }

  const cookieStore = cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
        for (const cookie of cookiesToSet) {
          response.cookies.set(cookie.name, cookie.value, cookie.options);
        }
      }
    }
  }) as unknown as AuthExchangeClient;
}
