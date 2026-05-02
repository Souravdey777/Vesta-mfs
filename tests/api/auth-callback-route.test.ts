import { describe, expect, it, vi } from "vitest";

import { GET } from "@/app/auth/callback/route";
import { getAuthCallbackResponse } from "@/lib/server/auth-callback";

describe("auth callback route", () => {
  it("exchanges a code and redirects home", async () => {
    const exchangeCodeForSession = vi.fn(async () => ({
      error: null
    }));
    const response = await getAuthCallbackResponse(
      new Request("http://localhost/auth/callback?code=abc"),
      {
        authClient: {
          auth: {
            exchangeCodeForSession
          }
        }
      }
    );

    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/");
  });

  it("redirects home without leaking invalid callback errors", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await getAuthCallbackResponse(
      new Request("http://localhost/auth/callback?code=bad"),
      {
        authClient: {
          auth: {
            exchangeCodeForSession: async () => ({
              error: {
                message: "invalid auth code"
              }
            })
          }
        }
      }
    );

    consoleSpy.mockRestore();

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/");
    expect(response.headers.get("location")).not.toContain("invalid auth code");
  });

  it("redirects missing-code requests home", async () => {
    const response = await GET(new Request("http://localhost/auth/callback"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/");
  });
});
