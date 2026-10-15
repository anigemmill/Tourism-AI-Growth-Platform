import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading, AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/auth/AccountForms";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <AuthHeading title="Forgotten your password?">Enter the email you sign in with and we&apos;ll send you a link to choose a new one.</AuthHeading>
      <ForgotPasswordForm />
      <p className="mt-8 border-t border-line pt-6 text-sm text-muted">
        <Link href="/login" className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">Back to sign in</Link>
      </p>
    </AuthShell>
  );
}
