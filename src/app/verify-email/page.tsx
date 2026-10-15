import type { Metadata } from "next";
import { AuthHeading, AuthShell } from "@/components/auth/AuthShell";
import { ConfirmEmailForm } from "@/components/auth/AccountForms";
import { InvalidLink } from "@/components/auth/InvalidLink";
import { peekToken } from "@/lib/auth/account-tokens";

export const metadata: Metadata = { title: "Confirm your email", referrer: "no-referrer" };

// Confirmation needs a button press (POST), so link scanners that open
// emailed URLs can't confirm an address on the owner's behalf.
export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const { token } = await searchParams;
  const t = typeof token === "string" ? await peekToken(token, "EMAIL_VERIFY") : null;
  return (
    <AuthShell>
      {t ? (
        <>
          <AuthHeading title="Confirm your email">Confirm {t.user.email} as the address for your account.</AuthHeading>
          <ConfirmEmailForm token={token as string} />
        </>
      ) : (
        <InvalidLink title="This link has expired" action={{ href: "/login", label: "Go to sign in" }}>
          Sign in and send a new confirmation link from your account page.
        </InvalidLink>
      )}
    </AuthShell>
  );
}
