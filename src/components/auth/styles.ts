// Class names shared by the auth forms (client components) and pages.
// Kept apart from AuthShell so client bundles never import server code.

// Dark primary action. bg-night stays dark in both schemes; the Findable
// brand rounds it into a pill (globals.css .auth-btn).
export const authButtonClass =
  "auth-btn inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-night px-4 text-sm font-medium text-night-ink shadow-[0_8px_20px_-10px_rgba(22,22,22,0.6)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";

export const authInputClass =
  "auth-input block h-11 w-full rounded-xl border border-line-strong bg-surface px-3.5 text-sm text-ink placeholder:text-subtle transition-colors focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/15 aria-[invalid=true]:border-danger";

export const authLabelClass = "mb-1.5 block text-[13px] font-medium text-ink";
