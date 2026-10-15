import type { Metadata } from "next";
import { AuthHeading, AuthShell } from "@/components/auth/AuthShell";
import { NewPasswordForm } from "@/components/auth/AccountForms";
import { InvalidLink } from "@/components/auth/InvalidLink";
import { peekToken } from "@/lib/auth/account-tokens";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";

export const metadata: Metadata = { title: "Choose a new password", referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token } = await searchParams;
  const t = typeof token === "string" ? await peekToken(token, "PASSWORD_RESET") : null;
  return (
    <AuthShell>
      {t && t.user.status === "ACTIVE" ? (
        <>
          <AuthHeading title="Choose a new password">For {t.user.email}. You&apos;ll be signed out everywhere and can then sign in with the new password.</AuthHeading>
          <NewPasswordForm token={token as string} mode="reset" minLength={MIN_PASSWORD_LENGTH} />
        </>
      ) : (
        <InvalidLink title="This link has expired">Password reset links work once and expire after an hour.</InvalidLink>
      )}
    </AuthShell>
  );
}
