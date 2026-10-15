import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, Badge, ButtonLink, Card, Checkbox, ExperimentStatusBadge, FormGrid, Notice, OppStatusBadge, PageHeader, Select, Table, TextArea, TextField, WorkStatusBadge } from "@/components/ui";
import { TaskList } from "@/components/TaskList";
import { TaskQuickAdd } from "@/components/TaskQuickAdd";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { staffOptions } from "@/lib/queries";
import { WORK_STATUS_LABELS, options } from "@/lib/labels";
import { formatNum, formatNzd } from "@/lib/format";
import { updateInitiative, upsertParticipant } from "../../actions";

export default async function InitiativePage({ params }: PageProps<"/collective/initiatives/[id]">) {
  await requirePermission("collective.view");
  const { id } = await params;
  const i = await prisma.sharedInitiative.findUnique({
    where: { id },
    include: {
      participants: { include: { operator: { select: { id: true, name: true, consentCohortSharing: true } } } },
      opportunities: true,
      projects: true,
      experiments: true,
      tasks: { include: { operator: { select: { id: true, name: true } }, assignee: { select: { name: true } } }, orderBy: { dueDate: "asc" } },
    },
  });
  if (!i) notFound();
  const [allOps, staffOpts] = await Promise.all([prisma.operator.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }), staffOptions()]);
  const participantOpts = i.participants.map((p) => ({ value: p.operator.id, label: p.operator.name }));
  const totalBookings = i.participants.reduce((s, p) => s + (p.attributedBookings ?? 0), 0);
  const totalRevenue = i.participants.reduce((s, p) => s + (p.attributedRevenueNzd ?? 0), 0);

  return (
    <div>
      <PageHeader
        eyebrow={<Link href="/collective?tab=initiatives" className="hover:underline">Shared initiatives</Link>}
        title={i.title}
        description={<span className="flex items-center gap-2"><Badge>{i.initiativeType}</Badge><WorkStatusBadge s={i.status} /></span>}
        actions={<><ButtonLink href={`/opportunities/new?initiativeId=${i.id}`}>Add opportunity</ButtonLink><ButtonLink href={`/experiments/new?initiativeId=${i.id}`} variant="primary">Design experiment</ButtonLink></>}
      />
      <div className="mb-6"><Notice tone="info">Participants see this initiative, its shared tasks and each other&apos;s responsibilities — never each other&apos;s confidential business data.</Notice></div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Participants, responsibilities & attribution" description={`Attributed so far: ${formatNum(totalBookings)} bookings · ${formatNzd(totalRevenue)} (as recorded by partners — see attribution method)`} padded={false}>
            <Table>
              <thead><tr><th>Operator</th><th>Role & responsibilities</th><th className="text-right">Bookings</th><th className="text-right">Revenue</th><th>Consent</th></tr></thead>
              <tbody>
                {i.participants.map((p) => (
                  <tr key={p.id}>
                    <td><Link href={`/operators/${p.operator.id}`} className="font-medium hover:underline">{p.operator.name}</Link></td>
                    <td className="text-sm"><p>{p.role}</p><p className="text-xs text-muted">{p.responsibilities}</p></td>
                    <td className="text-right tabular-nums">{formatNum(p.attributedBookings)}</td>
                    <td className="text-right tabular-nums">{formatNzd(p.attributedRevenueNzd)}</td>
                    <td>{p.consentConfirmed ? <Badge tone="success">Confirmed</Badge> : <Badge tone="warning">Pending</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <details className="border-t border-line p-5">
              <summary className="cursor-pointer text-sm font-medium text-accent">Add or update a participant</summary>
              <div className="mt-3">
                <ActionForm action={upsertParticipant.bind(null, i.id)} submitLabel="Save participant">
                  <FormGrid>
                    <Select name="operatorId" label="Operator" required options={allOps.map((o) => ({ value: o.id, label: o.name }))} placeholder="Choose…" />
                    <TextField name="role" label="Role" placeholder="e.g. Accommodation partner" />
                    <TextField name="attributedBookings" label="Attributed bookings" type="number" step="1" />
                    <TextField name="attributedRevenueNzd" label="Attributed revenue (NZD)" type="number" />
                  </FormGrid>
                  <TextArea name="responsibilities" label="Agreed responsibilities" rows={2} />
                  <Checkbox name="consentConfirmed" label="Operator has confirmed participation and what will be shared with partners" />
                </ActionForm>
              </div>
            </details>
          </Card>
          <Card title="Shared tasks">
            <TaskList tasks={i.tasks} />
            <details className="mt-4"><summary className="cursor-pointer text-sm font-medium text-accent">Add shared task</summary><div className="mt-3"><TaskQuickAdd initiativeId={i.id} operatorOpts={participantOpts} staffOpts={staffOpts} /></div></details>
          </Card>
          <Card title="Opportunities, projects & experiments" padded={false}>
            <Table>
              <tbody>
                {i.opportunities.map((o) => <tr key={o.id}><td className="text-xs text-muted">Opportunity</td><td><Link href={`/opportunities/${o.id}`} className="hover:underline">{o.title}</Link></td><td><OppStatusBadge s={o.status} /></td></tr>)}
                {i.projects.map((p) => <tr key={p.id}><td className="text-xs text-muted">Project</td><td><Link href={`/work/projects/${p.id}`} className="hover:underline">{p.title}</Link></td><td><WorkStatusBadge s={p.status} /></td></tr>)}
                {i.experiments.map((e) => <tr key={e.id}><td className="text-xs text-muted">Experiment</td><td><Link href={`/experiments/${e.id}`} className="hover:underline">{e.title}</Link></td><td><ExperimentStatusBadge s={e.status} /></td></tr>)}
              </tbody>
            </Table>
          </Card>
        </div>
        <Card title="Initiative details">
          <ActionForm action={updateInitiative.bind(null, i.id)} submitLabel="Save">
            <TextField name="title" label="Title" defaultValue={i.title} required />
            <TextField name="initiativeType" label="Type" defaultValue={i.initiativeType} required />
            <Select name="status" label="Status" options={options(WORK_STATUS_LABELS)} defaultValue={i.status} />
            <TextArea name="description" label="Description" defaultValue={i.description} required />
            <TextArea name="attributionMethod" label="Booking attribution method" defaultValue={i.attributionMethod} rows={3} />
            <TextArea name="results" label="Results" defaultValue={i.results} rows={3} />
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
