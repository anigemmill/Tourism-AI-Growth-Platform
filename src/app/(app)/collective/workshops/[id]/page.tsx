import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, Card, FormGrid, PageHeader, Select, Table, TextArea, TextField, WorkStatusBadge } from "@/components/ui";
import { TaskList } from "@/components/TaskList";
import { TaskQuickAdd } from "@/components/TaskQuickAdd";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { operatorOptions, staffOptions } from "@/lib/queries";
import { WORK_STATUS_LABELS, options } from "@/lib/labels";
import { toDateInput } from "@/lib/format";
import { saveAttendance, updateWorkshop } from "../../actions";

export default async function WorkshopPage({ params }: PageProps<"/collective/workshops/[id]">) {
  await requirePermission("collective.view");
  const { id } = await params;
  const w = await prisma.workshop.findUnique({
    where: { id },
    include: {
      attendance: true,
      learnings: { select: { id: true, title: true } },
      tasks: { include: { operator: { select: { id: true, name: true } }, assignee: { select: { name: true } } } },
    },
  });
  if (!w) notFound();
  const [ops, operatorOpts, staffOpts] = await Promise.all([
    prisma.operator.findMany({ where: { programmeId: w.programmeId, status: { notIn: ["WITHDRAWN", "PROSPECT"] } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    operatorOptions(), staffOptions(),
  ]);
  const att = new Map(w.attendance.map((a) => [a.operatorId, a]));

  return (
    <div>
      <PageHeader eyebrow={<Link href="/collective" className="hover:underline">Growth Collective</Link>} title={w.title} description={<span className="flex items-center gap-2">Week {w.week} <WorkStatusBadge s={w.status} /></span>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Attendance & engagement">
            <ActionForm action={saveAttendance.bind(null, w.id)} submitLabel="Save attendance">
              <Table>
                <thead><tr><th>Operator</th><th>Attended</th><th>Engagement (1–5)</th><th>Notes</th></tr></thead>
                <tbody>
                  {ops.map((o) => {
                    const a = att.get(o.id);
                    return (
                      <tr key={o.id}>
                        <td className="font-medium">{o.name}</td>
                        <td><input type="checkbox" name={`${o.id}.attended`} defaultChecked={a?.attended} aria-label={`${o.name} attended`} className="h-4 w-4 accent-[var(--brand)]" /></td>
                        <td><input type="number" min={1} max={5} name={`${o.id}.engagement`} defaultValue={a?.engagement ?? ""} aria-label={`${o.name} engagement`} className="w-16 rounded-md border border-line-strong bg-surface px-2 py-1 text-sm" /></td>
                        <td><input name={`${o.id}.notes`} defaultValue={a?.notes ?? ""} aria-label={`${o.name} notes`} className="w-full rounded-md border border-line-strong bg-surface px-2 py-1 text-sm" /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </ActionForm>
          </Card>
          <Card title="Actions from this workshop">
            <TaskList tasks={w.tasks} />
            <details className="mt-4"><summary className="cursor-pointer text-sm font-medium text-accent">Add action</summary><div className="mt-3"><TaskQuickAdd workshopId={w.id} operatorOpts={operatorOpts} staffOpts={staffOpts} /></div></details>
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Details">
            <ActionForm action={updateWorkshop.bind(null, w.id)} submitLabel="Save">
              <TextField name="title" label="Title" defaultValue={w.title} required />
              <FormGrid>
                <TextField name="week" label="Week" type="number" step="1" defaultValue={w.week} required />
                <TextField name="date" label="Date" type="date" defaultValue={toDateInput(w.date)} />
              </FormGrid>
              <TextField name="location" label="Venue / link" defaultValue={w.location} />
              <Select name="status" label="Status" options={options(WORK_STATUS_LABELS)} defaultValue={w.status} />
              <TextArea name="agenda" label="Agenda (visible to operators)" defaultValue={w.agenda} rows={5} />
              <TextArea name="notes" label="Staff notes & discussion (internal)" defaultValue={w.notes} rows={5} />
            </ActionForm>
          </Card>
          <Card title="Learnings captured">
            {w.learnings.length === 0 ? <p className="text-sm text-muted">None yet — record them under Collective → Learnings.</p> : <ul className="list-disc pl-4 text-sm">{w.learnings.map((l) => <li key={l.id}>{l.title}</li>)}</ul>}
          </Card>
        </div>
      </div>
    </div>
  );
}
