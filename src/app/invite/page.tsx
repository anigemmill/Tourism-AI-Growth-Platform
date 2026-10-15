import type { Metadata } from "next";
import { AuthHeading, AuthShell } from "@/components/auth/AuthShell";
import { NewPasswordForm } from "@/components/auth/AccountForms";
import { InvalidLink } from "@/components/auth/InvalidLink";
import { peekToken } from "@/lib/auth/account-tokens";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";

export const metadata: Metadata = { title: "Accept your invitation", referrer: "no-referrer" };

export default async function InvitePage({ searchParams }: PageProps<"/invite">) {
  const { token } = await searchParams;
  const t = typeof token === "string" ? await peekToken(token, "INVITE") : null;
  return (
    <AuthShell>
      {t && t.user.status === "PENDING" ? (
        <>
          <AuthHeading title="Welcome to Tourism AI Growth OS">Set a password to activate your account for {t.user.email}.</AuthHeading>
          <NewPasswordForm token={token as string} mode="invite" minLength={MIN_PASSWORD_LENGTH} name={t.user.name} />
        </>
      ) : (
        <InvalidLink title="This invitation isn't valid" action={{ href: "/login", label: "Go to sign in" }}>
          It may have expired, been replaced by a newer invitation, or already been used. Ask your programme lead to resend it.
        </InvalidLink>
      )}
    </AuthShell>
  );
}
