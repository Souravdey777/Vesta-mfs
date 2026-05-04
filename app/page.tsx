import { AuthGate } from "@/components/auth-gate";
import { MfScreenerApp } from "@/components/mf-screener-app";

export default function Home() {
  return (
    <AuthGate>
      <MfScreenerApp />
    </AuthGate>
  );
}
