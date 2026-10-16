import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ActionForm, AssessmentStatusBadge, Badge, ButtonLink, Card, Checkbox, DefinitionList, EmptyState, ExperimentStatusBadge,
  FormGrid, HorizonBadge, IllustrativeBadge, Notice, OperatorStatusBadge, OppStatusBadge, PageHeader, Stat, SyntheticBadge,
  Table, Tabs, TextArea, TextField, WorkStatusBadge,
} from "@/components/ui";
import { TaskList } from "@/components/TaskList";
import { TaskQuickAdd } from "@/components/TaskQuickAdd";
import { ClientVisibilityToggle } from "@/components/ClientVisibilityToggle";
import { can, requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { staffOptions } from "@/lib/queries";
import { priorityScore, roadmapOrder } from "@/lib/domain/prioritise";
import { compareMeasurements } from "@/lib/domain/results";
import { SOLUTION_LABELS, METRIC_LABELS } from "@/lib/labels";
import { formatDate, formatNum, pct, toDateInput } from "@/lib/format";
import { startAssessment, updateGovernance } from "../actions";

export default async function OperatorPage({ params }: PageProps<"/operators/[id]">) {
  const user = await requirePermission("operators.view");
  const { id } = await params;
  const op = await prisma.operator.findUnique({
    where: { id },
    include: {
      assessments: { orderBy: { createdAt: "desc" } },
      opportunities: true,
      projects: { orderBy: { createdAt: "desc" } },
      tasks: { orderBy: [{ status: "asc" }, { dueDate: "asc" }], include: { assignee: { select: { name: true } }, project: { select: { id: true, title: true } } } },
      experiments: { orderBy: { createdAt: "desc" } },
      measurements: true,
      attendance: true,
      initiatives: { include: { initiative: true } },
      users: { select: { email: true, name: true, status: true, lastLoginAt: true } },
      workflowUses: { include: { asset: { select: { id: true, name: true, status: true } } } },
    },
  });
  if (!op) notFound();

  const [staffOpts, workshopCount] = await Promise.all([
    staffOptions(),
    op.programmeId ? prisma.workshop.count({ where: { programmeId: op.programmeId, status: "DONE" } }) : Promise.resolve(0),
  ]);

  const roadmap = roadmapOrder(op.opportunities);
  const comparisons = compareMeasurements(op.measurements);
  const attended = op.attendance.filter((a) => a.attended).length;
  const openTasks = op.tasks.filter((t) => !["DONE", "CANCELLED"].includes(t.status));
  const latestAssessment = op.assessments[0];

  return (
    <div>
      <PageHeader
        eyebrow={<Link href="/operators" className="hover:underline">Operators</Link>}
        title={op.name}
        description={
          <span className="flex flex-wrap items-center gap-1.5">
            <OperatorStatusBadge s={op.status} />
            <Badge>{op.category}</Badge>
            {op.isSynthetic && <SyntheticBadge />}
            {op.groupTags.map((t) => <Badge key={t} tone="outline">{t}</Badge>)}
          </span>
        }
        actions={
          <>
            <ButtonLink href={`/reports/operator/${op.id}`}>Operator report</ButtonLink>
            <ButtonLink href={`/operators/${op.id}/edit`}>Edit profile</ButtonLink>
            <ButtonLink href={`/opportunities/new?operatorId=${op.id}`} variant="primary">Add opportunity</ButtonLink>
          </>
        }
      />

      <Tabs current={`/operators/${op.id}`} tabs={[{ href: `/operators/${op.id}`, label: "Workspace" }, { href: `/operators/${op.id}/intelligence`, label: "Growth Intelligence" }]} />

      {op.culturalGuidance && (
        <div className="mb-6">
          <Notice tone="warning">
            <strong className="font-semibold">Cultural guidance: </strong>
            {op.culturalGuidance}
          </Notice>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="AI maturity" value={op.aiMaturity ? `${op.aiMaturity}/5` : "—"} />
        <Stat label="Opportunities" value={op.opportunities.length} sub={`${op.opportunities.filter((o) => o.horizon === "NOW").length} marked NOW`} />
        <Stat label="Open tasks" value={openTasks.length} />
        <Stat label="Experiments" value={op.experiments.length} />
        <Stat label="Workshop attendance" value={workshopCount ? `${attended}/${workshopCount}` : "—"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="AI opportunity roadmap" description="Ordered by horizon, then priority score (impact ÷ effort × confidence)." actions={<ButtonLink href={`/opportunities?operator=${op.id}`}>Open in register</ButtonLink>} padded={false}>
            {roadmap.length === 0 ? (
              <div className="p-5"><EmptyState title="No opportunities recorded">Complete an assessment, then record opportunities from it.</EmptyState></div>
            ) : (
              <Table>
                <thead><tr><th>Opportunity</th><th>Type</th><th>Horizon</th><th className="text-right">Score</th><th>Status</th><th>Client</th></tr></thead>
                <tbody>
                  {roadmap.map((o) => (
                    <tr key={o.id}>
                      <td><Link href={`/opportunities/${o.id}`} className="font-medium hover:underline">{o.title}</Link><p className="text-xs text-muted">{o.problem}</p></td>
                      <td className="text-muted">{SOLUTION_LABELS[o.solutionType]}</td>
                      <td><HorizonBadge h={o.horizon} /></td>
                      <td className="text-right tabular-nums">{priorityScore(o)}</td>
                      <td><OppStatusBadge s={o.status} /></td>
                      <td><ClientVisibilityToggle kind="opportunity" id={o.id} visibility={o.visibility} operatorId={o.operatorId} editable={can(user, "opportunities.edit")} /></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card title="Tasks" description={`${openTasks.length} open`}>
            <TaskList tasks={op.tasks} showOperator={false} clientVisibility={can(user, "work.edit") ? "edit" : "show"} />
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-accent">Add a task for {op.name}</summary>
              <div className="mt-4"><TaskQuickAdd operatorId={op.id} staffOpts={staffOpts} /></div>
            </details>
          </Card>

          <Card title="Implementation projects" actions={<ButtonLink href={`/work/projects/new?operatorId=${op.id}`}>New project</ButtonLink>} padded={false}>
            {op.projects.length === 0 ? (
              <div className="p-5"><EmptyState title="No projects yet">Convert an approved opportunity into a project.</EmptyState></div>
            ) : (
              <Table>
                <thead><tr><th>Project</th><th>Status</th><th>Due</th><th>Approved</th><th>Adoption</th><th>Client</th></tr></thead>
                <tbody>
                  {op.projects.map((p) => (
                    <tr key={p.id}>
                      <td><Link href={`/work/projects/${p.id}`} className="font-medium hover:underline">{p.title}</Link></td>
                      <td><WorkStatusBadge s={p.status} /></td>
                      <td className="text-muted">{formatDate(p.dueDate)}</td>
                      <td className="text-muted">{p.approvedBy ? `${p.approvedBy}, ${formatDate(p.approvedAt)}` : "—"}</td>
                      <td className="text-muted">{p.adoption ?? "—"}</td>
                      <td><ClientVisibilityToggle kind="project" id={p.id} visibility={p.visibility} operatorId={p.operatorId} editable={can(user, "work.edit")} /></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card title="Baselines & results" description="Latest baseline vs latest result per metric." actions={<ButtonLink href={`/results?operator=${op.id}`}>Record measurement</ButtonLink>} padded={false}>
            {comparisons.length === 0 ? (
              <div className="p-5"><EmptyState title="No baseline recorded">Baselines should be captured in weeks 1–2 before any change is made.</EmptyState></div>
            ) : (
              <Table>
                <thead><tr><th>Metric</th><th className="text-right">Baseline</th><th className="text-right">Result</th><th className="text-right">Change</th><th /></tr></thead>
                <tbody>
                  {comparisons.map((c) => (
                    <tr key={c.key}>
                      <td>{c.label ?? METRIC_LABELS[c.metric]}<p className="text-xs text-subtle">{c.unit}</p></td>
                      <td className="text-right tabular-nums">{formatNum(c.baseline)}</td>
                      <td className="text-right tabular-nums">{formatNum(c.result)}</td>
                      <td className={`text-right tabular-nums ${c.improved === true ? "text-success" : c.improved === false ? "text-danger" : "text-muted"}`}>
                        {c.change == null ? "—" : `${c.change > 0 ? "+" : ""}${formatNum(c.change)}${c.changePct != null ? ` (${pct(c.changePct)})` : ""}`}
                      </td>
                      <td>{c.illustrative && <IllustrativeBadge />}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card title="Experiments" padded={false} actions={<ButtonLink href={`/experiments/new?operatorId=${op.id}`}>New experiment</ButtonLink>}>
            {op.experiments.length === 0 ? (
              <div className="p-5"><EmptyState title="No experiments" /></div>
            ) : (
              <Table>
                <tbody>
                  {op.experiments.map((e) => (
                    <tr key={e.id}>
                      <td><Link href={`/experiments/${e.id}`} className="font-medium hover:underline">{e.title}</Link><p className="text-xs text-muted">{e.hypothesis}</p></td>
                      <td><ExperimentStatusBadge s={e.status} /></td>
                      <td><ClientVisibilityToggle kind="experiment" id={e.id} visibility={e.visibility} operatorId={e.operatorId} editable={can(user, "experiments.edit")} /></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Assessment">
            {latestAssessment ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between"><AssessmentStatusBadge s={latestAssessment.status} /><span className="text-xs text-muted">{formatDate(latestAssessment.conductedAt)}</span></div>
                <p className="text-muted">{latestAssessment.summary ?? "No summary yet."}</p>
                <Link href={`/assessments/${latestAssessment.id}`} className="text-sm font-medium text-accent hover:underline">Open assessment →</Link>
              </div>
            ) : (
              <EmptyState title="Not assessed yet" />
            )}
            <div className="mt-4">
              <ActionForm action={startAssessment.bind(null, op.id)} submitLabel={latestAssessment ? "Start a new assessment" : "Start assessment"} variant="secondary" />
            </div>
          </Card>

          <Card title="Profile">
            <DefinitionList
              items={[
                { label: "Contact", value: [op.contactName, op.contactEmail, op.contactPhone].filter(Boolean).join(" · ") },
                { label: "Website", value: op.websiteUrl && <a href={op.websiteUrl} className="text-accent hover:underline" target="_blank" rel="noreferrer">{op.websiteUrl}</a> },
                { label: "Booking link", value: op.bookingUrl && <a href={op.bookingUrl} className="text-accent hover:underline" target="_blank" rel="noreferrer">{op.bookingUrl}</a> },
                { label: "Experiences", value: op.experiences },
                { label: "Target markets", value: op.targetMarkets.join(", ") },
                { label: "Marketing channels", value: op.marketingChannels.join(", ") },
                { label: "Technology & AI tools", value: op.techStack.join(", ") },
                { label: "Booking & enquiries", value: op.bookingProcess },
                { label: "Objectives", value: op.objectives },
                { label: "Challenges", value: op.challenges },
                { label: "Capacity & seasonality", value: op.seasonality },
                { label: "Internal notes", value: op.internalNotes },
              ]}
            />
          </Card>

          <Card title="Growth Collective">
            {op.initiatives.length === 0 ? (
              <p className="text-sm text-muted">Not part of a shared initiative yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {op.initiatives.map((p) => (
                  <li key={p.id}>
                    <Link href={`/collective/initiatives/${p.initiativeId}`} className="font-medium hover:underline">{p.initiative.title}</Link>
                    <p className="text-xs text-muted">{p.role ?? "Participant"}{p.consentConfirmed ? "" : " · consent not confirmed"}</p>
                  </li>
                ))}
              </ul>
            )}
            {op.workflowUses.length > 0 && (
              <div className="mt-4 border-t border-line pt-3">
                <p className="mb-1 text-xs font-medium text-muted">Workflows in use</p>
                <ul className="space-y-1 text-sm">
                  {op.workflowUses.map((u) => (
                    <li key={u.id}><Link href={`/library/${u.asset.id}`} className="hover:underline">{u.asset.name}</Link> <span className="text-xs text-subtle">· {u.status}</span></li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card title="Permissions & data sharing" description="Records what has been agreed. This is a workflow record, not proof of legal compliance.">
            <ActionForm action={updateGovernance.bind(null, op.id)} submitLabel="Save permissions">
              <TextArea name="agreedScope" label="Agreed scope" defaultValue={op.agreedScope} rows={2} />
              <TextField name="dataAgreementSignedAt" label="Data agreement signed" type="date" defaultValue={toDateInput(op.dataAgreementSignedAt)} />
              <div className="space-y-2">
                <Checkbox name="consentCohortSharing" label="May share learnings with the cohort" defaultChecked={op.consentCohortSharing} />
                <Checkbox name="consentAggregate" label="May include in anonymised aggregate reporting" defaultChecked={op.consentAggregate} />
                <Checkbox name="consentCaseStudy" label="May use in public case studies" defaultChecked={op.consentCaseStudy} hint="Each case study still needs the operator's sign-off on the final text." />
              </div>
              <TextArea name="dataRetentionNotes" label="Retention & deletion" defaultValue={op.dataRetentionNotes} rows={2} />
              <TextArea name="culturalGuidance" label="Cultural guidance & authority" defaultValue={op.culturalGuidance} rows={3} hint="Who holds authority over cultural content, and what must never be put into AI tools." />
            </ActionForm>
          </Card>

          <Card title="Operator logins">
            {op.users.length === 0 ? (
              <p className="text-sm text-muted">No portal access. Founder can invite under Users & access.</p>
            ) : (
              <FormGrid cols={1}>
                {op.users.map((u) => (
                  <div key={u.email} className="text-sm">
                    <p className="font-medium">{u.name}</p>
                    <p className="text-xs text-muted">{u.email} · {u.status === "ACTIVE" ? `last login ${formatDate(u.lastLoginAt)}` : u.status.toLowerCase()}</p>
                  </div>
                ))}
              </FormGrid>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
