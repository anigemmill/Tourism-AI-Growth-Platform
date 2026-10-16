import Link from "next/link";
import type { Task, WorkStatus } from "@/generated/prisma";
import { ActionForm, Badge, EmptyState, Table, WorkStatusBadge } from "@/components/ui";
import { setTaskStatus } from "@/app/(app)/work/actions";
import { WORK_STATUS_LABELS } from "@/lib/labels";
import { formatShortDate } from "@/lib/format";
import { ClientVisibilityToggle } from "@/components/ClientVisibilityToggle";

type Row = Task & {
  operator?: { id: string; name: string } | null;
  assignee?: { name: string } | null;
  project?: { id: string; title: string } | null;
};

export function isOverdue(t: { dueDate: Date | null; status: WorkStatus }, now = new Date()) {
  return !!t.dueDate && t.dueDate < now && t.status !== "DONE" && t.status !== "CANCELLED";
}

/**
 * `clientVisibility`: show whether each task is visible to its business
 * ("show"), with a control to change it ("edit"). Off by default.
 */
export function TaskList({ tasks, showOperator = true, editable = true, clientVisibility }: { tasks: Row[]; showOperator?: boolean; editable?: boolean; clientVisibility?: "show" | "edit" }) {
  if (tasks.length === 0) return <EmptyState title="No tasks here" />;
  return (
    <Table>
      <thead>
        <tr>
          <th>Task</th>
          {showOperator && <th>Operator</th>}
          <th>Owner</th>
          <th>Due</th>
          <th>Status</th>
          {clientVisibility && <th>Client</th>}
        </tr>
      </thead>
      <tbody>
        {tasks.map((t) => (
          <tr key={t.id}>
            <td className="min-w-[14rem]">
              <p className="font-medium text-ink">{t.title}</p>
              {t.project && (
                <Link href={`/work/projects/${t.project.id}`} className="text-xs text-muted hover:underline">
                  {t.project.title}
                </Link>
              )}
            </td>
            {showOperator && (
              <td className="text-muted">
                {t.operator ? <Link href={`/operators/${t.operator.id}`} className="hover:underline">{t.operator.name}</Link> : <span className="text-subtle">Programme</span>}
              </td>
            )}
            <td className="text-muted">{t.assignee?.name ?? t.ownerLabel ?? <span className="text-subtle">Unassigned</span>}</td>
            <td className="whitespace-nowrap">
              {isOverdue(t) ? <Badge tone="danger">Overdue · {formatShortDate(t.dueDate)}</Badge> : <span className="text-muted">{formatShortDate(t.dueDate)}</span>}
            </td>
            <td>
              {editable ? (
                <ActionForm action={setTaskStatus.bind(null, t.id)} inline submitLabel="Set" variant="ghost">
                  <label className="sr-only" htmlFor={`st-${t.id}`}>Status</label>
                  <select id={`st-${t.id}`} name="status" defaultValue={t.status} className="rounded-md border border-line-strong bg-surface px-2 py-1 text-xs">
                    {Object.entries(WORK_STATUS_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </ActionForm>
              ) : (
                <WorkStatusBadge s={t.status} />
              )}
            </td>
            {clientVisibility && (
              <td><ClientVisibilityToggle kind="task" id={t.id} visibility={t.visibility} operatorId={t.operatorId} editable={clientVisibility === "edit"} /></td>
            )}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
