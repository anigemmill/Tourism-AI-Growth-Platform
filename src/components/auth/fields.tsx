"use client";

import { useState } from "react";
import { authInputClass, authLabelClass } from "./AuthShell";

type FieldProps = {
  id: string;
  name: string;
  label: string;
  error?: string;
  hint?: string;
  autoComplete?: string;
  required?: boolean;
  defaultValue?: string;
};

function describedBy(id: string, error?: string, hint?: string) {
  return [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ") || undefined;
}

function Messages({ id, error, hint }: { id: string; error?: string; hint?: string }) {
  return (
    <>
      {hint && !error && <p id={`${id}-hint`} className="mt-1.5 text-xs text-subtle">{hint}</p>}
      {error && <p id={`${id}-error`} className="mt-1.5 text-xs text-danger">{error}</p>}
    </>
  );
}

export function AuthField({ type = "text", ...p }: FieldProps & { type?: "text" | "email" | "date" }) {
  return (
    <div>
      <label htmlFor={p.id} className={authLabelClass}>{p.label}</label>
      <input
        id={p.id}
        name={p.name}
        type={type}
        required={p.required}
        autoComplete={p.autoComplete}
        defaultValue={p.defaultValue}
        aria-invalid={p.error ? true : undefined}
        aria-describedby={describedBy(p.id, p.error, p.hint)}
        className={authInputClass}
      />
      <Messages id={p.id} error={p.error} hint={p.hint} />
    </div>
  );
}

export function PasswordField({ minLength, ...p }: FieldProps & { minLength?: number }) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={p.id} className={authLabelClass}>{p.label}</label>
      <div className="relative">
        <input
          id={p.id}
          name={p.name}
          type={visible ? "text" : "password"}
          required={p.required}
          minLength={minLength}
          autoComplete={p.autoComplete}
          aria-invalid={p.error ? true : undefined}
          aria-describedby={describedBy(p.id, p.error, p.hint)}
          className={`${authInputClass} pr-16`}
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-controls={p.id}
          className="absolute inset-y-1 right-1 rounded-lg px-3 text-xs font-medium text-muted hover:bg-surface-2 hover:text-ink"
        >
          {visible ? "Hide" : "Show"}<span className="sr-only"> {p.label.toLowerCase()}</span>
        </button>
      </div>
      <Messages id={p.id} error={p.error} hint={p.hint} />
    </div>
  );
}
