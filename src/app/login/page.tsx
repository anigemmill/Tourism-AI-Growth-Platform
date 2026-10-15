import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { setupAvailable } from "@/lib/setup";
import { AuthHeading, AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "OPERATOR" ? "/portal" : "/");
  const sp = await searchParams;
  const next = sp.next;
  const setupDone = sp.setup === "done";
  // Account creation is self-service only for the first founder (/setup);
  // everyone else is invited. Offer the link only while setup is open.
  const canCreateAccount = !setupDone && (await setupAvailable().catch(() => false));

  return (
    <AuthShell>
      <AuthHeading title="Welcome back">Sign in to your Tourism AI Growth OS account.</AuthHeading>
      {setupDone && (
        <p role="status" className="mb-6 rounded-xl border border-success/25 bg-success-soft px-3.5 py-2.5 text-sm text-success">
          Account created. Sign in with your new founder account, then remove SETUP_TOKEN from Vercel.
        </p>
      )}
      <LoginForm next={typeof next === "string" ? next : undefined} />
      <div className="mt-8 space-y-3 border-t border-line pt-6 text-sm text-muted">
        {canCreateAccount ? (
          <p>
            New here?{" "}
            <Link href="/setup" className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
              Create an account
            </Link>
          </p>
        ) : (
          <p>New here? Access is by invitation — ask your programme lead for an account.</p>
        )}
        <p className="text-xs leading-relaxed text-subtle">
          Forgotten your password? Your programme lead can reset it. Operators only see their own business information and content the cohort has agreed to share.
        </p>
      </div>
    </AuthShell>
  );
}
