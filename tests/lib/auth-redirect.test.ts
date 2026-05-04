import { afterEach, describe, expect, it } from "vitest";

import { getAuthCallbackUrl, getAuthHomeUrl } from "@/lib/auth-redirect";

describe("auth redirect URLs", () => {
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  afterEach(() => {
    if (originalSiteUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
    }
  });

  it("uses the configured production site origin for magic links", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://vesta-mfs.vercel.app/some/path";

    expect(getAuthCallbackUrl("http://localhost:3000")).toBe(
      "https://vesta-mfs.vercel.app/auth/callback"
    );
  });

  it("uses the configured production site origin after exchanging the callback code", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://vesta-mfs.vercel.app/";

    expect(getAuthHomeUrl("http://localhost/auth/callback?code=abc").toString()).toBe(
      "https://vesta-mfs.vercel.app/"
    );
  });

  it("ignores a localhost site URL when the app is running on a production host", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";

    expect(getAuthCallbackUrl("https://vesta-mfs.vercel.app")).toBe(
      "https://vesta-mfs.vercel.app/auth/callback"
    );
    expect(getAuthHomeUrl("https://vesta-mfs.vercel.app/auth/callback?code=abc").toString()).toBe(
      "https://vesta-mfs.vercel.app/"
    );
  });

  it("falls back to the active origin when no production URL is configured", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;

    expect(getAuthCallbackUrl("http://localhost:3000")).toBe(
      "http://localhost:3000/auth/callback"
    );
  });
});
