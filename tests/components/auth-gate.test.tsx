import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthGate, type AuthGateSupabaseClient } from "@/components/auth-gate";

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
          emailRedirectTo: "http://localhost:3000/auth/callback"
        }
      })
    );
    expect(await screen.findByText("Check your email for the sign-in link.")).toBeInTheDocument();
  });
});

function createAuthClient(
  session: Awaited<ReturnType<AuthGateSupabaseClient["auth"]["getSession"]>>["data"]["session"],
  signInWithOtp = vi.fn(async () => ({ error: null }))
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
      signInWithOtp
    }
  };
}
