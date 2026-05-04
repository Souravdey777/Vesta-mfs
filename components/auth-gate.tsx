"use client";

import * as React from "react";
import { Loader2, LockKeyhole, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type AuthUser = {
  email?: string | null;
};

type AuthSession = {
  user?: AuthUser | null;
} | null;

export type AuthGateSupabaseClient = {
  auth: {
    getSession(): Promise<{
      data: {
        session: AuthSession;
      };
      error: { message: string } | null;
    }>;
    onAuthStateChange(
      callback: (event: string, session: AuthSession) => void
    ): {
      data?: {
        subscription?: {
          unsubscribe(): void;
        };
      };
    };
    signInWithOtp(input: {
      email: string;
      options: {
        emailRedirectTo: string;
      };
    }): Promise<{
      error: { message: string } | null;
    }>;
  };
};

type AuthGateStatus = "checking" | "signed-in" | "signed-out";

type AuthGateProps = {
  children: React.ReactNode;
  supabase?: AuthGateSupabaseClient;
};

export function AuthGate({ children, supabase: suppliedSupabase }: AuthGateProps) {
  const [supabase] = React.useState<AuthGateSupabaseClient | undefined>(
    () => suppliedSupabase ?? getOptionalSupabaseClient()
  );
  const [email, setEmail] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<AuthGateStatus>("checking");

  React.useEffect(() => {
    let mounted = true;

    async function readSession() {
      if (!supabase) {
        setStatus("signed-out");
        return;
      }

      try {
        const { data } = await supabase.auth.getSession();

        if (mounted) {
          setStatus(data.session?.user ? "signed-in" : "signed-out");
        }
      } catch {
        if (mounted) {
          setStatus("signed-out");
        }
      }
    }

    void readSession();

    const listener = supabase?.auth.onAuthStateChange((_event, nextSession) => {
      setStatus(nextSession?.user ? "signed-in" : "signed-out");
    });

    return () => {
      mounted = false;
      listener?.data?.subscription?.unsubscribe();
    };
  }, [supabase]);

  async function handleSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!supabase) {
      setMessage("Sign in is unavailable in this environment.");
      return;
    }

    if (!email.trim()) {
      setMessage("Enter your email.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) {
        setMessage("Could not send the sign-in link.");
        return;
      }

      setMessage("Check your email for the sign-in link.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (status === "signed-in") {
    return <>{children}</>;
  }

  if (status === "checking") {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4">
        <div className="flex items-center gap-3 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
          Checking your session
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="mb-6 flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <LockKeyhole className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">MF Screener AI</p>
            <h1 className="text-xl font-semibold tracking-normal text-foreground">
              Sign in to continue
            </h1>
          </div>
        </div>

        <form className="grid gap-4" onSubmit={(event) => void handleSignIn(event)}>
          <div className="grid gap-2">
            <Label htmlFor="page-auth-email">Email</Label>
            <Input
              autoComplete="email"
              id="page-auth-email"
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              type="email"
              value={email}
            />
          </div>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          <Button className="w-full" disabled={isSubmitting} type="submit">
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Mail className="h-4 w-4" aria-hidden="true" />
            )}
            Send magic link
          </Button>
        </form>
      </section>
    </main>
  );
}

function getOptionalSupabaseClient(): AuthGateSupabaseClient | undefined {
  try {
    return createBrowserSupabaseClient() as unknown as AuthGateSupabaseClient;
  } catch {
    return undefined;
  }
}
