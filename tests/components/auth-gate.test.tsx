import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthGate, type AuthGateSupabaseClient } from "@/components/auth-gate";
import { getAuthCallbackUrl } from "@/lib/auth-redirect";

describe("AuthGate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("blocks children and shows sign-in when there is no session", async () => {
    render(
      <AuthGate supabase={createAuthClient(null)}>
        <div>Protected screener</div>
      </AuthGate>
    );

    expect(screen.getByRole("status")).toHaveTextContent("Checking your session");
    expect(await screen.findByRole("heading", { name: "Sign in to continue" })).toBeInTheDocument();
    expect(screen.queryByText("Protected screener")).not.toBeInTheDocument();
  });

  it("renders children when the user has a session", async () => {
    render(
      <AuthGate
        supabase={createAuthClient({
          user: {
            email: "investor@example.com"
          }
        })}
      >
        <div>Protected screener</div>
      </AuthGate>
    );

    expect(await screen.findByText("Protected screener")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sign in to continue" })).not.toBeInTheDocument();
  });

  it("sends the page-level magic link", async () => {
    const signInWithOtp = vi.fn(async () => ({ error: null }));

    render(
      <AuthGate supabase={createAuthClient(null, signInWithOtp)}>
        <div>Protected screener</div>
      </AuthGate>
    );

    fireEvent.change(await screen.findByLabelText("Email"), {
      target: {
        value: "investor@example.com"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Send magic link" }));

    await waitFor(() =>
      expect(signInWithOtp).toHaveBeenCalledWith({
        email: "investor@example.com",
        options: {
          emailRedirectTo: getAuthCallbackUrl()
        }
      })
    );
    expect(await screen.findByText("Check your email for the sign-in link.")).toBeInTheDocument();
  });

  it("starts page-level Google sign-in", async () => {
    const signInWithOAuth = vi.fn(async () => ({ error: null }));

    render(
      <AuthGate supabase={createAuthClient(null, undefined, signInWithOAuth)}>
        <div>Protected screener</div>
      </AuthGate>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Continue with Google" }));

    await waitFor(() =>
      expect(signInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo: getAuthCallbackUrl()
        }
      })
    );
    expect(await screen.findByText("Redirecting to Google...")).toBeInTheDocument();
  });

  it("shows the Supabase Google sign-in error when OAuth cannot start", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const signInWithOAuth = vi.fn(async () => ({
      error: {
        message: "provider is disabled"
      }
    }));

    render(
      <AuthGate supabase={createAuthClient(null, undefined, signInWithOAuth)}>
        <div>Protected screener</div>
      </AuthGate>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Continue with Google" }));

    expect(
      await screen.findByText("Could not start Google sign-in: provider is disabled")
    ).toBeInTheDocument();
  });

  it("shows the Supabase magic-link error when email sending fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const signInWithOtp = vi.fn(async () => ({
      error: {
        message: "Email rate limit exceeded"
      }
    }));

    render(
      <AuthGate supabase={createAuthClient(null, signInWithOtp)}>
        <div>Protected screener</div>
      </AuthGate>
    );

    fireEvent.change(await screen.findByLabelText("Email"), {
      target: {
        value: "investor@example.com"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Send magic link" }));

    expect(
      await screen.findByText("Could not send the sign-in link: Email rate limit exceeded")
    ).toBeInTheDocument();
  });
});

function createAuthClient(
  session: Awaited<ReturnType<AuthGateSupabaseClient["auth"]["getSession"]>>["data"]["session"],
  signInWithOtp: AuthGateSupabaseClient["auth"]["signInWithOtp"] = vi.fn(async () => ({
    error: null
  })),
  signInWithOAuth: NonNullable<AuthGateSupabaseClient["auth"]["signInWithOAuth"]> = vi.fn(
    async () => ({
      error: null
    })
  )
): AuthGateSupabaseClient {
  return {
    auth: {
      getSession: async () => ({
        data: {
          session
        },
        error: null
      }),
      onAuthStateChange: () => ({
        data: {
          subscription: {
            unsubscribe: () => {}
          }
        }
      }),
      signInWithOtp,
      signInWithOAuth
    }
  };
}
