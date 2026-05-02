"use client";

import * as React from "react";
import { LogOut, Mail, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type AuthUser = {
  email?: string | null;
};

type AuthSession = {
  user?: AuthUser | null;
} | null;

export type AuthSupabaseClient = {
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
    signOut(): Promise<{
      error: { message: string } | null;
    }>;
  };
};

type ChatAuthCtaProps = {
  supabase?: AuthSupabaseClient;
};

export function ChatAuthCta({ supabase: suppliedSupabase }: ChatAuthCtaProps) {
  const [supabase] = React.useState<AuthSupabaseClient | undefined>(
    () => suppliedSupabase ?? getOptionalSupabaseClient()
  );
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [session, setSession] = React.useState<AuthSession>(null);

  React.useEffect(() => {
    let mounted = true;

    async function readSession() {
      if (!supabase) {
        return;
      }

      const { data } = await supabase.auth.getSession();

      if (mounted) {
        setSession(data.session);
      }
    }

    void readSession();

    const listener = supabase?.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
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

  async function handleSignOut() {
    if (!supabase) {
      return;
    }

    const { error } = await supabase.auth.signOut();

    if (!error) {
      setSession(null);
      setMessage(null);
    }
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1">
        <UserRound className="h-4 w-4 text-primary" aria-hidden="true" />
        <span className="max-w-[150px] truncate text-xs text-muted-foreground">
          {session.user.email ?? "Signed in"}
        </span>
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => void handleSignOut()}>
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign out
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setDialogOpen(true);
          setMessage(null);
        }}
      >
        <Mail className="h-4 w-4" aria-hidden="true" />
        Sign in
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign in to sync saved screens</DialogTitle>
            <DialogDescription>
              We will send a magic link to your email. Your saved filters stay under your account.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={(event) => void handleSignIn(event)}>
            <div className="grid gap-2">
              <Label htmlFor="auth-email">Email</Label>
              <Input
                autoComplete="email"
                id="auth-email"
                inputMode="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                type="email"
                value={email}
              />
              {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                Send link
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function getOptionalSupabaseClient(): AuthSupabaseClient | undefined {
  try {
    return createBrowserSupabaseClient() as unknown as AuthSupabaseClient;
  } catch {
    return undefined;
  }
}
