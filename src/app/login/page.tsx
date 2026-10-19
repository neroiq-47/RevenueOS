import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthShell title="Log in to RevenueOS">{null}</AuthShell>}>
      <LoginForm />
    </Suspense>
  );
}
