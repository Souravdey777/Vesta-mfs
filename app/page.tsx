import { redirect } from "next/navigation";

import { AuthGate } from "@/components/auth-gate";
import { MfScreenerApp } from "@/components/mf-screener-app";
import { getRootAuthCallbackPath } from "@/lib/auth-redirect";

type HomeProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function Home({ searchParams = {} }: HomeProps) {
  const authCallbackPath = getRootAuthCallbackPath(searchParams);

  if (authCallbackPath) {
    redirect(authCallbackPath);
  }

  return (
    <AuthGate>
      <MfScreenerApp />
    </AuthGate>
  );
}
