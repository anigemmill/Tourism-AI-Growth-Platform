import { ActionForm, Badge, ButtonLink, Card, FormGrid, Notice, PageHeader, Select, SeverityBadge, TextArea, TextField, WorkStatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { operatorOptions } from "@/lib/queries";
import { RISK_KIND_LABELS, SEVERITY_LABELS, WORK_STATUS_LABELS, options } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { createDecision, createRisk, resolveDecision, updateRisk } from "./actions";

export default async function GovernancePage() {
  await requirePermission("governance.view");
  const [risks, decisions, operatorOpts, consents] = await Promise.all([
    prisma.risk.findMany({ orderBy: [{ status: "asc" }, { severity: "desc" }], include: { operator: { select: { name: true } } } }),
    prisma.decisionRecord.findMany({ orderBy: [{ decided: "asc" }, { reviewDate: "asc" }], include: { operator: { select: { name: true } } } }),
    operatorOptions(),
    prisma.operator.findMany({ where: { status: { notIn: ["WITHDRAWN", "PROSPECT"] } }, select: { name: true, dataAgreementSignedAt: true, culturalGuidance: true } }),
  ]);
  return (
    <div>
      <PageHeader eyebrow="Governance" title="Risks, decisions & trust" description="Programme risks and blockers, decisions awaiting the founder, and the privacy and cultural-governance controls in place." actions={<ButtonLink href="/governance/audit">Audit log</ButtonLink>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Risks, blockers & issues">
          <ul className="divide-y divide-line">
            {risks.map((r) => (
              <li key={r.id} className="py-3 first:pt-0">
                <div className="flex flex-wrap items-center gap-1.5"><SeverityBadge s={r.severity} /><Badge>{RISK_KIND_LABELS[r.kind]}</Badge><WorkStatusBadge s={r.status} /></div>
                <p className="mt-1 font-medium">{r.title}</p>
                <p className="text-xs text-muted">{r.operator?.name ?? "Programme"} · owner {r.owner ?? "—"}</p>
                <details className="mt-1"><summary className="cursor-pointer text-xs text-accent">Update</summary>
                  <div className="mt-2"><ActionForm action={updateRisk.bind(null, r.id)} submitLabel="Save"><Select name="status" label="Status" options={options(WORK_STATUS_LABELS)} defaultValue={r.status} /><TextArea name="mitigation" label="Mitigation" defaultValue={r.mitigation} rows={2} /></ActionForm></div>
                </details>
              </li>
            ))}
          </ul>
          <details className="mt-4 border-t border-line pt-4"><summary className="cursor-pointer text-sm font-medium text-accent">Record a risk or blocker</summary>
            <div className="mt-3"><ActionForm action={createRisk} submitLabel="Record" resetOnSuccess>
              <FormGrid cols={3}><Select name="kind" label="Kind" options={options(RISK_KIND_LABELS)} defaultValue="RISK" /><Select name="severity" label="Severity" options={options(SEVERITY_LABELS)} defaultValue="MEDIUM" /><Select name="operatorId" label="Operator" options={operatorOpts} placeholder="Programme" /></FormGrid>
              <TextField name="title" label="Title" required /><TextField name="owner" label="Owner" /><TextArea name="mitigation" label="Mitigation" rows={2} />
            </ActionForm></div>
          </details>
        </Card>
        <Card title="Decisions">
          <ul className="divide-y divide-line">
            {decisions.map((d) => (
              <li key={d.id} className="py-3 first:pt-0">
                <p className="font-medium">{d.title} {d.decided ? <Badge tone="success">Decided</Badge> : <Badge tone="info">Open · review {formatDate(d.reviewDate)}</Badge>}</p>
                <p className="mt-1 text-sm text-muted">{d.whatChanged}</p>
                <p className="text-xs text-subtle">Evidence: {d.evidence ?? "—"} · Why: {d.whyItMatters ?? "—"} · Next: {d.nextAction ?? "—"} · Owner: {d.owner ?? "—"}{d.operator ? ` · ${d.operator.name}` : ""}</p>
                {d.decided ? <p className="mt-1 text-sm">Outcome: {d.outcome}</p> : (
                  <details className="mt-1"><summary className="cursor-pointer text-xs text-accent">Record outcome</summary><div className="mt-2"><ActionForm action={resolveDecision.bind(null, d.id)} submitLabel="Record decision"><TextArea name="outcome" label="Decision & rationale" required rows={2} /></ActionForm></div></details>
                )}
              </li>
            ))}
          </ul>
          <details className="mt-4 border-t border-line pt-4"><summary className="cursor-pointer text-sm font-medium text-accent">Log a decision needed</summary>
            <div className="mt-3"><ActionForm action={createDecision} submitLabel="Log" resetOnSuccess>
              <TextField name="title" label="Decision needed" required /><TextArea name="whatChanged" label="What changed?" required rows={2} /><TextArea name="evidence" label="Evidence" rows={2} /><TextArea name="whyItMatters" label="Why it matters" rows={2} />
              <FormGrid cols={3}><TextField name="nextAction" label="Next action" /><TextField name="owner" label="Owner" /><TextField name="reviewDate" label="Review on" type="date" /></FormGrid>
              <Select name="operatorId" label="Operator" options={operatorOpts} placeholder="Programme" />
            </ActionForm></div>
          </details>
        </Card>
        <Card title="Privacy & cultural governance controls" className="lg:col-span-2">
          <Notice tone="warning">These are workflow controls, not proof of legal compliance with the Privacy Act 2020 or any other obligation. Get advice where needed.</Notice>
          <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <li>✓ Operator data is isolated server-side; operators see only their own records and content marked for the cohort.</li>
            <li>✓ Sharing beyond an operator requires their recorded consent (cohort / aggregate / public), enforced on save.</li>
            <li>✓ Content flagged for cultural review cannot be shared until an approving authority is named.</li>
            <li>✓ AI outputs (briefs, workflow results) require human approval before operators see them.</li>
            <li>✓ Guest personal information is not collected; forms warn against it.</li>
            <li>✓ Every important change, login and export is recorded in the audit log.</li>
            <li>✓ Full data export is available as a low-tech fallback.</li>
            <li>• {consents.filter((c) => !c.dataAgreementSignedAt).length} active operators have no signed data agreement; {consents.filter((c) => c.culturalGuidance).length} have recorded cultural guidance.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
