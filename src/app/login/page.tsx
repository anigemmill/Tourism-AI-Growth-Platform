import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthHeading, AuthShell } from "@/components/auth/AuthShell";
import Link from "next/link";
import { getBrand, newLayoutEnabled } from "@/lib/brand";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "OPERATOR" ? "/portal" : "/");
  const sp = await searchParams;
  const next = sp.next;
  // Accounts are created by invitation only. The one-time first super admin
  // bootstrap (/setup) is deliberately not linked from here.
  const notice =
    sp.setup === "done" ? "Account created. Sign in with your new super admin account, then remove SETUP_TOKEN from Vercel."
    : sp.reset === "done" ? "Password changed. Sign in with your new password."
    : sp.invite === "done" ? "Your account is active. Sign in to get started."
    : null;

  const brand = getBrand();
  const newLayout = newLayoutEnabled();
  return (
    <AuthShell panelTitle="Welcome back.">
      {brand.id === "findable" ? (
        <AuthHeading eyebrow="Sign in" title="Sign in to Findable.">Use the email address your invitation was sent to.</AuthHeading>
      ) : (
        <AuthHeading title="Welcome back">Sign in to your Tourism AI Growth OS account.</AuthHeading>
      )}
      {notice && (
        <p role="status" className="mb-6 rounded-xl border border-success/25 bg-success-soft px-3.5 py-2.5 text-sm text-success">{notice}</p>
      )}
      <LoginForm next={typeof next === "string" ? next : undefined} forgotInline={newLayout} />
      {!newLayout && (
        <p className="mt-4 text-right text-sm">
          <Link href="/forgot-password" className="text-muted underline decoration-line-strong underline-offset-4 hover:text-ink hover:decoration-ink">
            Forgotten your password?
          </Link>
        </p>
      )}
      <div className="mt-6 space-y-3 border-t border-line pt-6 text-sm text-muted">
        <p>{brand.id === "findable" ? "New to Findable? Accounts are by invitation for now — contact us to get started." : "New here? Access is by invitation — ask your programme lead for an account."}</p>
        <p className="text-xs leading-relaxed text-subtle">
          Operators only see their own business information and content the cohort has agreed to share.
        </p>
      </div>
    </AuthShell>
  );
}
