// Accessible form fields. Plain HTML inputs so they work inside server
// components and degrade gracefully without JavaScript.

import type { ReactNode } from "react";
import { cx } from "./primitives";

const inputCls =
  "block w-full rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 disabled:opacity-60";

interface BaseProps {
  name: string;
  label: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
}

function Wrap({ name, label, hint, required, className, children }: BaseProps & { children: ReactNode }) {
  return (
    <div className={cx("min-w-0", className)}>
      <label htmlFor={`f-${name}`} className="mb-1 block text-xs font-medium text-muted">
        {label}
        {required && <span className="ml-0.5 text-danger" aria-hidden>*</span>}
      </label>
      {children}
      {hint && <p id={`f-${name}-hint`} className="mt-1 text-xs text-subtle">{hint}</p>}
    </div>
  );
}

export function TextField({
  type = "text",
  defaultValue,
  placeholder,
  step,
  min,
  max,
  autoComplete,
  ...p
}: BaseProps & {
  type?: "text" | "email" | "url" | "number" | "date" | "password" | "tel";
  defaultValue?: string | number | null;
  placeholder?: string;
  step?: string;
  min?: number | string;
  max?: number | string;
  autoComplete?: string;
}) {
  return (
    <Wrap {...p}>
      <input
        id={`f-${p.name}`}
        name={p.name}
        type={type}
        required={p.required}
        defaultValue={defaultValue ?? undefined}
        placeholder={placeholder}
        step={step ?? (type === "number" ? "any" : undefined)}
        min={min}
        max={max}
        autoComplete={autoComplete}
        aria-describedby={p.hint ? `f-${p.name}-hint` : undefined}
        className={inputCls}
      />
    </Wrap>
  );
}

export function TextArea({
  defaultValue,
  rows = 3,
  placeholder,
  ...p
}: BaseProps & { defaultValue?: string | null; rows?: number; placeholder?: string }) {
  return (
    <Wrap {...p}>
      <textarea
        id={`f-${p.name}`}
        name={p.name}
        rows={rows}
        required={p.required}
        defaultValue={defaultValue ?? undefined}
        placeholder={placeholder}
        aria-describedby={p.hint ? `f-${p.name}-hint` : undefined}
        className={inputCls}
      />
    </Wrap>
  );
}

export function Select({
  options,
  defaultValue,
  placeholder,
  ...p
}: BaseProps & {
  options: { value: string; label: string }[];
  defaultValue?: string | null;
  placeholder?: string;
}) {
  return (
    <Wrap {...p}>
      <select
        id={`f-${p.name}`}
        name={p.name}
        required={p.required}
        defaultValue={defaultValue ?? ""}
        aria-describedby={p.hint ? `f-${p.name}-hint` : undefined}
        className={inputCls}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Wrap>
  );
}

export function Checkbox({
  name,
  label,
  defaultChecked,
  hint,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
  hint?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <input
        id={`f-${name}`}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 rounded border-line-strong accent-[var(--brand)]"
      />
      <div>
        <label htmlFor={`f-${name}`} className="text-sm text-ink">
          {label}
        </label>
        {hint && <p className="text-xs text-subtle">{hint}</p>}
      </div>
    </div>
  );
}

export function FormGrid({ children, cols = 2 }: { children: ReactNode; cols?: 1 | 2 | 3 }) {
  const c = cols === 1 ? "" : cols === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2";
  return <div className={cx("grid grid-cols-1 gap-4", c)}>{children}</div>;
}

export function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <fieldset className="border-t border-line pt-5 first:border-t-0 first:pt-0">
      <legend className="sr-only">{title}</legend>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {description && <p className="mb-3 mt-0.5 text-xs text-muted">{description}</p>}
      <div className={description ? "" : "mt-3"}>{children}</div>
    </fieldset>
  );
}

/**
 * Required confirmation for destructive or high-impact actions. Checked on
 * the server too (see `confirmed` in src/lib/forms.ts).
 */
export function ConfirmBox({ children, required = true }: { children: ReactNode; required?: boolean }) {
  return (
    <label className="flex items-start gap-2 text-xs text-muted">
      <input type="checkbox" name="confirm" value="yes" required={required} className="mt-0.5 h-4 w-4 shrink-0 rounded border-line-strong accent-[var(--brand)]" />
      <span>{children}</span>
    </label>
  );
}
