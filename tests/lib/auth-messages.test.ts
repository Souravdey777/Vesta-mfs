import { describe, expect, it } from "vitest";

import { getMagicLinkErrorMessage } from "@/lib/auth-messages";

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
});
