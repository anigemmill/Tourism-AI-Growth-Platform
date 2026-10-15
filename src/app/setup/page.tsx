import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { setupAvailable } from "@/lib/setup";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { AuthHeading, AuthShell } from "@/components/auth/AuthShell";
import { SetupForm } from "./SetupForm";

export const metadata: Metadata = { title: "Create your account" };

export default async function SetupPage() {
  // Must be evaluated per request (env + user count), never prerendered.
  await connection();
  // Invisible once a user exists or when SETUP_TOKEN is not configured.
  if (!(await setupAvailable())) notFound();
  return (
    <AuthShell>
      <AuthHeading title="Create your account">
        First-run setup: creates the founder account and the programme skeleton. No demo data. This page closes once it has been used.
      </AuthHeading>
      <SetupForm minPasswordLength={MIN_PASSWORD_LENGTH} />
      <p className="mt-8 border-t border-line pt-6 text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
