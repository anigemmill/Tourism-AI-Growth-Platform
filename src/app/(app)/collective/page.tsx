import Link from "next/link";
import {
  ActionForm, Badge, Card, Checkbox, EmptyState, FormGrid, PageHeader, Select, Table, Tabs, TextArea, TextField, VisibilityBadge, WorkStatusBadge,
} from "@/components/ui";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { activeProgramme, operatorOptions, initiativeOptions } from "@/lib/queries";
import { weekStart } from "@/lib/domain/programme";
import { CULTURAL_LABELS, VISIBILITY_LABELS, WORK_STATUS_LABELS, options } from "@/lib/labels";
import { formatDate, formatShortDate } from "@/lib/format";
import { createInitiative, createLearning, createResource, createWorkshop, setLearningVisibility } from "./actions";

const TABS = ["workshops", "initiatives", "learnings", "resources", "engagement"] as const;

export default async function CollectivePage({ searchParams }: PageProps<"/collective">) {
  await requirePermission("collective.view");
  const requested = (await searchParams).tab;
  const tab = TABS.find((t) => t === requested) ?? "workshops";
  const programme = await activeProgramme();

  return (
    <div>
      <PageHeader
        eyebrow="Programme"
        title="Tourism AI Growth Collective"
        description="Shared workshops, collaborative initiatives and documented learning. Shared content is separated from each operator's confidential information by visibility level and recorded consent. Use your existing chat/email tools for discussion — this is the record, not a social network."
      />
      <Tabs current={`/collective?tab=${tab}`} tabs={TABS.map((t) => ({ href: `/collective?tab=${t}`, label: t[0].toUpperCase() + t.slice(1) }))} />
      {tab === "workshops" && <Workshops programmeStart={programme?.startDate} />}
      {tab === "initiatives" && <Initiatives />}
      {tab === "learnings" && <Learnings />}
      {tab === "resources" && <Resources />}
      {tab === "engagement" && <Engagement />}
    </div>
  );
}

async function Workshops({ programmeStart }: { programmeStart?: Date }) {
  const workshops = await prisma.workshop.findMany({ orderBy: { week: "asc" }, include: { attendance: true, _count: { select: { learnings: true, tasks: true } } } });
  return (
    <div className="space-y-6">
      <Card padded={false}>
        {workshops.length === 0 ? <div className="p-5"><EmptyState title="No workshops scheduled" /></div> : (
          <Table>
            <thead><tr><th>Week</th><th>Workshop</th><th>Status</th><th className="text-right">Attended</th><th className="text-right">Learnings</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {workshops.map((w) => (
                <tr key={w.id}>
                  <td className="whitespace-nowrap text-muted">Wk {w.week}<p className="text-xs text-subtle">{formatShortDate(w.date ?? (programmeStart ? weekStart(programmeStart, w.week) : null))}</p></td>
                  <td><Link href={`/collective/workshops/${w.id}`} className="font-medium hover:underline">{w.title}</Link><p className="line-clamp-1 text-xs text-muted">{w.agenda?.split("\n").join(" · ")}</p></td>
                  <td><WorkStatusBadge s={w.status} /></td>
                  <td className="text-right tabular-nums">{w.status === "DONE" ? `${w.attendance.filter((a) => a.attended).length}/${w.attendance.length}` : "—"}</td>
                  <td className="text-right tabular-nums">{w._count.learnings}</td>
                  <td className="text-right tabular-nums">{w._count.tasks}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <Card title="Schedule a workshop">
        <ActionForm action={createWorkshop} submitLabel="Add workshop" resetOnSuccess>
          <FormGrid cols={3}>
            <TextField name="title" label="Title" required className="sm:col-span-2" />
            <TextField name="week" label="Programme week" type="number" step="1" required />
            <TextField name="date" label="Date" type="date" />
            <TextField name="location" label="Venue / link" />
            <Select name="status" label="Status" options={options(WORK_STATUS_LABELS)} defaultValue="TODO" />
          </FormGrid>
          <TextArea name="agenda" label="Agenda (one item per line)" rows={3} />
        </ActionForm>
      </Card>
    </div>
  );
}

async function Initiatives() {
  const rows = await prisma.sharedInitiative.findMany({ orderBy: { createdAt: "desc" }, include: { participants: { include: { operator: { select: { name: true } } } }, _count: { select: { experiments: true, tasks: true } } } });
  return (
    <div className="space-y-6">
      {rows.length === 0 && <EmptyState title="No shared initiatives yet">For example: an accommodation operator and an activity provider building an overnight package.</EmptyState>}
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((i) => (
          <Card key={i.id} title={<Link href={`/collective/initiatives/${i.id}`} className="hover:underline">{i.title}</Link>} description={i.initiativeType} actions={<WorkStatusBadge s={i.status} />}>
            <p className="text-sm text-muted">{i.description}</p>
            <div className="mt-3 flex flex-wrap gap-1">{i.participants.map((p) => <Badge key={p.id} tone={p.consentConfirmed ? "accent" : "warning"}>{p.operator.name}{p.consentConfirmed ? "" : " (consent pending)"}</Badge>)}</div>
            <p className="mt-3 text-xs text-subtle">{i._count.tasks} tasks · {i._count.experiments} experiments</p>
          </Card>
        ))}
      </div>
      <Card title="New shared initiative">
        <ActionForm action={createInitiative} submitLabel="Create initiative">
          <FormGrid>
            <TextField name="title" label="Title" required />
            <Select name="initiativeType" label="Type" required options={["overnight-package", "stay-another-night", "co-marketing", "shared-content", "shared-workflow", "other"].map((v) => ({ value: v, label: v }))} placeholder="Choose…" />
            <Select name="status" label="Status" options={options(WORK_STATUS_LABELS)} defaultValue="TODO" />
          </FormGrid>
          <TextArea name="description" label="Description" required />
          <TextArea name="attributionMethod" label="How will bookings be attributed between partners?" rows={2} />
        </ActionForm>
      </Card>
    </div>
  );
}

async function Learnings() {
  const [rows, operatorOpts, initiativeOpts, workshops] = await Promise.all([
    prisma.learning.findMany({ orderBy: { createdAt: "desc" }, include: { operator: { select: { name: true } }, workshop: { select: { title: true } } } }),
    operatorOptions(), initiativeOptions(),
    prisma.workshop.findMany({ orderBy: { week: "asc" }, select: { id: true, title: true } }),
  ]);
  return (
    <div className="space-y-6">
      <Card title="Learnings & reusable processes" description="Widening visibility checks the source operator's consent and any cultural review." padded={false}>
        {rows.length === 0 ? <div className="p-5"><EmptyState title="No learnings yet" /></div> : (
          <Table>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id}>
                  <td className="min-w-[18rem]">
                    <p className="font-medium">{l.title} {l.isReusableProcess && <Badge tone="accent">Reusable process</Badge>}</p>
                    <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-xs text-muted">{l.body}</p>
                    <p className="mt-1 text-xs text-subtle">{[l.topic, l.operator?.name, l.workshop?.title, formatDate(l.createdAt)].filter(Boolean).join(" · ")}</p>
                  </td>
                  <td className="w-[22rem]">
                    <div className="mb-2 flex flex-wrap gap-1"><VisibilityBadge v={l.visibility} />{l.culturalReview !== "NOT_APPLICABLE" && <Badge tone={l.culturalReview === "REQUIRED" ? "danger" : "success"}>{CULTURAL_LABELS[l.culturalReview]}</Badge>}</div>
                    <details>
                      <summary className="cursor-pointer text-xs text-accent">Change sharing</summary>
                      <div className="mt-2">
                        <ActionForm action={setLearningVisibility.bind(null, l.id)} submitLabel="Apply">
                          <Select name="visibility" label="Visible to" options={options(VISIBILITY_LABELS)} defaultValue={l.visibility} />
                          <Select name="culturalReview" label="Cultural review" options={options(CULTURAL_LABELS)} defaultValue={l.culturalReview} />
                          <TextField name="culturalApprovedBy" label="Approved by (authority)" defaultValue={l.culturalApprovedBy} />
                        </ActionForm>
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <Card title="Record a learning">
        <ActionForm action={createLearning} submitLabel="Save learning" resetOnSuccess>
          <FormGrid>
            <TextField name="title" label="Title" required />
            <TextField name="topic" label="Topic" />
            <Select name="operatorId" label="Source operator" options={operatorOpts} placeholder="Programme / cohort" />
            <Select name="workshopId" label="From workshop" options={workshops.map((w) => ({ value: w.id, label: w.title }))} placeholder="—" />
            <Select name="initiativeId" label="Initiative" options={initiativeOpts} placeholder="—" />
            <Select name="visibility" label="Visible to" options={options(VISIBILITY_LABELS)} defaultValue="INTERNAL" />
            <Select name="culturalReview" label="Cultural content?" options={options(CULTURAL_LABELS)} defaultValue="NOT_APPLICABLE" hint="Never paste restricted mātauranga or cultural narratives into AI tools." />
            <TextField name="culturalApprovedBy" label="Approved by (if approved)" />
          </FormGrid>
          <TextArea name="body" label="What did we learn?" required rows={4} />
          <Checkbox name="isReusableProcess" label="This is a reusable process other operators can follow" />
        </ActionForm>
      </Card>
    </div>
  );
}

async function Resources() {
  const rows = await prisma.resource.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <div className="space-y-6">
      <Card padded={false}>
        {rows.length === 0 ? <div className="p-5"><EmptyState title="No resources yet" /></div> : (
          <Table>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">{r.title}</a> : <span className="font-medium">{r.title}</span>}<p className="text-xs text-muted">{r.description}</p></td>
                  <td className="text-xs text-muted">{r.resourceType}</td>
                  <td><VisibilityBadge v={r.visibility} /></td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <Card title="Add resource" description="Link to files in your existing storage (Drive, Notion). The platform does not host files in phase 1.">
        <ActionForm action={createResource} submitLabel="Add resource" resetOnSuccess>
          <FormGrid>
            <TextField name="title" label="Title" required />
            <Select name="resourceType" label="Type" required options={["template", "guide", "checklist", "slides", "recording"].map((v) => ({ value: v, label: v }))} defaultValue="template" />
            <TextField name="url" label="Link" type="url" placeholder="https://" />
            <Select name="visibility" label="Visible to" options={options(VISIBILITY_LABELS)} defaultValue="COHORT" />
            <Select name="culturalReview" label="Cultural content?" options={options(CULTURAL_LABELS)} defaultValue="NOT_APPLICABLE" />
          </FormGrid>
          <TextArea name="description" label="Description" rows={2} />
        </ActionForm>
      </Card>
    </div>
  );
}

async function Engagement() {
  const [operators, held] = await Promise.all([
    prisma.operator.findMany({
      where: { status: { notIn: ["WITHDRAWN", "PROSPECT"] } },
      orderBy: { name: "asc" },
      include: { attendance: { where: { workshop: { status: "DONE" } } }, _count: { select: { learnings: true, initiatives: true, signals: { where: { submittedByOperator: true } } } } },
    }),
    prisma.workshop.count({ where: { status: "DONE" } }),
  ]);
  return (
    <Card title="Participation & engagement" description="Attendance across held workshops, staff-rated engagement (1–5), contributions." padded={false}>
      <Table>
        <thead><tr><th>Operator</th><th className="text-right">Attended</th><th className="text-right">Avg engagement</th><th className="text-right">Learnings</th><th className="text-right">Initiatives</th><th className="text-right">Updates sent</th></tr></thead>
        <tbody>
          {operators.map((o) => {
            const att = o.attendance.filter((a) => a.attended).length;
            const eng = o.attendance.filter((a) => a.engagement != null);
            const avg = eng.length ? eng.reduce((s, a) => s + (a.engagement ?? 0), 0) / eng.length : null;
            return (
              <tr key={o.id}>
                <td><Link href={`/operators/${o.id}`} className="font-medium hover:underline">{o.name}</Link></td>
                <td className={`text-right tabular-nums ${held && att / held < 0.5 ? "text-warning" : ""}`}>{att}/{held}</td>
                <td className="text-right tabular-nums">{avg ? avg.toFixed(1) : "—"}</td>
                <td className="text-right tabular-nums">{o._count.learnings}</td>
                <td className="text-right tabular-nums">{o._count.initiatives}</td>
                <td className="text-right tabular-nums">{o._count.signals}</td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Card>
  );
}
