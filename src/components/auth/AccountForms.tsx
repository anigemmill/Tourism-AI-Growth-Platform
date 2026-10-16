"use client";

// Forms for the signed-out account pages (forgot / reset password, accept
// invitation, confirm email). Same patterns as the sign-in form: entries are
// kept on a rejected attempt and double submits are ignored.

import { startTransition, useActionState, type ReactNode } from "react";
import type { ActionState } from "@/lib/forms";
import { acceptInvitation, confirmEmail, forgotPassword, resetPassword } from "@/app/actions/account";
import { authButtonClass } from "./styles";
import { AuthField, PasswordField } from "./fields";
import { Spinner } from "./Spinner";

type Action = (s: ActionState, fd: FormData) => Promise<ActionState>;

function Form({ action, children, label, busyLabel }: { action: Action; children: (state: ActionState) => ReactNode; label: string; busyLabel: string }) {
  const [state, run, pending] = useActionState(action, undefined);
  const formError = state?.error && !Object.keys(state.fieldErrors ?? {}).length ? state.error : undefined;
  return (
    <form
      action={run}
      aria-busy={pending}
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        const fd = new FormData(e.currentTarget);
        startTransition(() => run(fd));
      }}
    >
      {children(state)}
      {formError && <p role="alert" className="rounded-xl border border-danger/25 bg-danger-soft px-3.5 py-2.5 text-sm text-danger">{formError}</p>}
      {state?.ok && <p role="status" className="rounded-xl border border-success/25 bg-success-soft px-3.5 py-2.5 text-sm text-success">{state.ok}</p>}
      {!state?.ok && (
        <button type="submit" disabled={pending} className={authButtonClass}>
          {pending && <Spinner />}
          {pending ? busyLabel : label}
        </button>
      )}
    </form>
  );
}

const err = (s: ActionState, k: string) => s?.fieldErrors?.[k]?.[0];

export function ForgotPasswordForm() {
  return (
    <Form action={forgotPassword} label="Send reset link" busyLabel="Sending…">
      {() => <AuthField id="email" name="email" type="email" label="Email" autoComplete="username" required />}
    </Form>
  );
}

export function NewPasswordForm({ token, mode, minLength, name }: { token: string; mode: "reset" | "invite"; minLength: number; name?: string }) {
  return (
    <Form action={mode === "reset" ? resetPassword : acceptInvitation} label={mode === "reset" ? "Set new password" : "Activate account"} busyLabel="Saving…">
      {(s) => (
        <>
          <input type="hidden" name="token" value={token} />
          {mode === "invite" && <AuthField id="name" name="name" label="Your name" autoComplete="name" defaultValue={name} required />}
          <PasswordField id="password" name="password" label="New password" autoComplete="new-password" required minLength={minLength} error={err(s, "password")} hint={`At least ${minLength} characters.`} />
          <PasswordField id="confirm" name="confirm" label="Confirm new password" autoComplete="new-password" required error={err(s, "confirm")} />
        </>
      )}
    </Form>
  );
}

export function ConfirmEmailForm({ token }: { token: string }) {
  return (
    <Form action={confirmEmail} label="Confirm email address" busyLabel="Confirming…">
      {() => <input type="hidden" name="token" value={token} />}
    </Form>
  );
}
