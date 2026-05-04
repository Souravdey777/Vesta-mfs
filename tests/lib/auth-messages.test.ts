import { describe, expect, it } from "vitest";

import { getMagicLinkErrorMessage, getOAuthSignInErrorMessage } from "@/lib/auth-messages";

describe("auth messages", () => {
  it("shows the Supabase magic-link send error", () => {
    expect(getMagicLinkErrorMessage({ message: "Email rate limit exceeded" })).toBe(
      "Could not send the sign-in link: Email rate limit exceeded"
    );
  });

  it("falls back when Supabase does not return an error message", () => {
    expect(getMagicLinkErrorMessage(null)).toBe(
      "Could not send the sign-in link. Check Supabase Auth logs for details."
    );
  });

  it("shows the Supabase OAuth start error", () => {
    expect(getOAuthSignInErrorMessage("Google", { message: "provider is disabled" })).toBe(
      "Could not start Google sign-in: provider is disabled"
    );
  });

  it("falls back when OAuth does not return an error message", () => {
    expect(getOAuthSignInErrorMessage("Google", null)).toBe(
      "Could not start Google sign-in. Check Supabase Auth logs for details."
    );
  });
});
