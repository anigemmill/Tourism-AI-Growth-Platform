"use client";

import { startTransition, useActionState } from "react";
import { authButtonClass } from "@/components/auth/AuthShell";
import { AuthField, PasswordField } from "@/components/auth/fields";
import { Spinner } from "@/components/auth/Spinner";
import { runSetup } from "./actions";

export function SetupForm({ minPasswordLength }: { minPasswordLength: number }) {
  const [state, action, pending] = useActionState(runSetup, undefined);
  const err = (k: string) => state?.fieldErrors?.[k]?.[0];
  // A field-level message is shown next to its field; anything else up top.
  const formError = state?.error && !Object.keys(state.fieldErrors ?? {}).length ? state.error : undefined;
  return (
    <form
      action={action}
      aria-busy={pending}
      className="space-y-5"
      onSubmit={(e) => {
        // Keep entries on a rejected attempt; block double submits.
        e.preventDefault();
        if (pending) return;
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      <PasswordField id="f-token" name="token" label="Setup token" autoComplete="off" required error={err("token")} hint="The SETUP_TOKEN value set in Vercel." />
      <AuthField id="f-name" name="name" label="Your name" autoComplete="name" required error={err("name")} />
      <AuthField id="f-email" name="email" type="email" label="Email" autoComplete="username" required error={err("email")} />
      <PasswordField
        id="f-password"
        name="password"
        label="Password"
        autoComplete="new-password"
        required
        minLength={minPasswordLength}
        error={err("password")}
        hint={`At least ${minPasswordLength} characters.`}
      />
      <PasswordField id="f-confirm" name="confirm" label="Confirm password" autoComplete="new-password" required error={err("confirm")} />
      <AuthField id="f-programmeStart" name="programmeStart" type="date" label="Programme start date (optional)" error={err("programmeStart")} hint="Week 1 of the programme — editable later." />
      {formError && (
        <p role="alert" className="rounded-xl border border-danger/25 bg-danger-soft px-3.5 py-2.5 text-sm text-danger">{formError}</p>
      )}
      <button type="submit" disabled={pending} className={authButtonClass}>
        {pending && <Spinner />}
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
