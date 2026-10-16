"use client";

import Link from "next/link";
import { startTransition, useActionState } from "react";
import { login } from "@/app/actions/auth";
import { authButtonClass } from "@/components/auth/styles";
import { AuthField, PasswordField } from "@/components/auth/fields";
import { Spinner } from "@/components/auth/Spinner";

/** `forgotInline`: Phase 1 puts "Forgot password?" beside the password label. */
export function LoginForm({ next, forgotInline = false }: { next?: string; forgotInline?: boolean }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form
      action={action}
      aria-busy={pending}
      className="space-y-5"
      onSubmit={(e) => {
        // Submit manually so a rejected attempt keeps the typed email (React
        // resets uncontrolled forms after a form action), and ignore repeat
        // submits while one is in flight. Without JS the plain action works.
        e.preventDefault();
        if (pending) return;
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      {next && <input type="hidden" name="next" value={next} />}
      <AuthField id="email" name="email" type="email" label="Email" autoComplete="username" required />
      <PasswordField
        id="password"
        name="password"
        label="Password"
        autoComplete="current-password"
        required
        labelAction={forgotInline ? <Link href="/forgot-password" className="text-accent underline decoration-line-strong underline-offset-4 hover:decoration-current">Forgot password?</Link> : undefined}
      />
      {state?.error && (
        <p role="alert" className="rounded-xl border border-danger/25 bg-danger-soft px-3.5 py-2.5 text-sm text-danger">{state.error}</p>
      )}
      <button type="submit" disabled={pending} className={authButtonClass}>
        {pending && <Spinner />}
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
