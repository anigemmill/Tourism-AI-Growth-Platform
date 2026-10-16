import { ActionForm, ConfirmBox } from "@/components/ui";
import { ACCOUNT_STATUS_LABELS } from "@/lib/labels";
import type { BusinessAccountStatus } from "@/generated/prisma";
import { enterEditModeAction, exitClientViewAction, leaveEditModeAction } from "./actions";

// Shown at the top of every client-view page: which business, which mode,
// and the way out. Rendered per page (not in the layout) so it always
// reflects the current edit grant.
export function SupportBanner({
  business,
  editingUntil,
}: {
  business: { id: string; name: string; accountStatus: BusinessAccountStatus };
  editingUntil: Date | null;
}) {
  const editing = Boolean(editingUntil);
  const until = editingUntil
    ? new Intl.DateTimeFormat("en-NZ", { hour: "numeric", minute: "2-digit", timeZone: "Pacific/Auckland" }).format(editingUntil)
    : null;
  return (
    <section
      aria-label="Client view"
      data-support-mode={editing ? "edit" : "read"}
      className={
        "mb-6 rounded-[var(--radius-card)] border px-4 py-3 " +
        (editing ? "border-warning/50 bg-warning-soft" : "border-line-strong bg-surface")
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow text-muted">{editing ? "Editing on behalf of the client" : "Client view · read-only"}</p>
          <p className="mt-1 text-sm text-ink">
            You&apos;re viewing <strong>{business.name}</strong> as the client sees it.
            {editing ? ` Changes you make are recorded as yours. Edit mode ends at ${until}.` : " Nothing can be changed until you turn on edit mode."}
          </p>
          {business.accountStatus !== "ACTIVE" && (
            <p className="mt-1 text-xs text-warning">Account is {ACCOUNT_STATUS_LABELS[business.accountStatus].toLowerCase()}: the client&apos;s own users can&apos;t sign in to it.</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editing ? (
            <ActionForm action={leaveEditModeAction.bind(null, business.id)} inline submitLabel="Turn off edit mode" variant="secondary" />
          ) : (
            <details className="group">
              <summary className="cursor-pointer list-none rounded-full border border-ink/80 px-3 py-1 text-xs font-medium text-ink hover:bg-ink hover:text-canvas">Turn on edit mode</summary>
              <div className="mt-2 w-72 max-w-full rounded-xl border border-line bg-surface p-3">
                <ActionForm action={enterEditModeAction.bind(null, business.id)} submitLabel="Turn on edit mode" variant="secondary">
                  <ConfirmBox>I&apos;m making changes for {business.name} with their agreement. Edit mode lasts 30 minutes and every change is logged under my name.</ConfirmBox>
                </ActionForm>
              </div>
            </details>
          )}
          <ActionForm action={exitClientViewAction.bind(null, business.id)} inline submitLabel="Exit to back office" variant="primary" />
        </div>
      </div>
    </section>
  );
}
