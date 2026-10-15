import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, Badge, Card, EmptyState, FormGrid, Notice, PageHeader, Select, Table, TextArea, TextField, Tabs } from "@/components/ui";
import { BriefView } from "@/components/BriefView";
import { ClaimBadge, CLAIM_LABELS } from "@/components/ClaimBadge";
import { requireStaff } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { CONFIDENCE_LABELS, CONTENT_BRIEF_STATUS_LABELS, CONTENT_TYPE_LABELS, VISIBILITY_LABELS, options } from "@/lib/labels";
import { INTEGRATION_REGISTRY, INTEGRATION_STATUS_LABELS, effectiveStatus } from "@/lib/integrations/registry";
import { isLLMConfigured } from "@/lib/llm/anthropic";
import { formatDate, toDateInput } from "@/lib/format";
import {
  addSignal, generateBrief, reviewBrief, setIntegration,
  addCompetitor, removeCompetitor, addContentBrief, transitionContentBrief, analyzeOperatorWebsite,
} from "./actions";

const CONTENT_BRIEF_TRANSITIONS: Record<string, { next: string; label: string }[]> = {
  PROPOSED: [{ next: "APPROVED", label: "Approve" }, { next: "REJECTED", label: "Reject" }],
  APPROVED: [{ next: "IN_PROGRESS", label: "Start drafting" }, { next: "REJECTED", label: "Reject" }],
  IN_PROGRESS: [{ next: "PUBLISHED", label: "Mark published" }],
  PUBLISHED: [],
  REJECTED: [],
};

const SIGNAL_TYPES = ["DEMAND", "ENQUIRY", "REVIEW", "AI_DISCOVERY", "COMPETITOR", "MARKET", "OPERATIONS"].map((v) => ({ value: v, label: v.replace("_", " ").toLowerCase() }));

export default async function IntelligencePage({ params }: PageProps<"/operators/[id]/intelligence">) {
  await requireStaff();
  const { id } = await params;
  const op = await prisma.operator.findUnique({
    where: { id },
    include: {
      signals: { orderBy: { sourceTimestamp: "desc" }, take: 50 },
      integrations: true,
      briefs: { orderBy: { createdAt: "desc" }, take: 6 },
      competitors: { orderBy: { name: "asc" } },
      contentBriefs: { orderBy: { createdAt: "desc" } },
      profile: true,
    },
  });
  if (!op) notFound();
  const latest = op.briefs[0];

  return (
    <div>
      <PageHeader
        eyebrow={<Link href={`/operators/${op.id}`} className="hover:underline">{op.name}</Link>}
        title="Growth Intelligence"
        description="Operator-level Scan → Brief → Learn. Signals are the evidence; briefs are built only from what is stored here, then reviewed and approved by a person before the operator sees them."
        actions={<ActionForm action={generateBrief.bind(null, op.id)} submitLabel="Generate draft brief" />}
      />
      <Tabs current={`/operators/${op.id}/intelligence`} tabs={[{ href: `/operators/${op.id}`, label: "Workspace" }, { href: `/operators/${op.id}/intelligence`, label: "Growth Intelligence" }]} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Weekly growth brief" description={latest ? `Status: ${latest.status.toLowerCase()}` : undefined}>
            {!latest ? (
              <EmptyState title="No brief yet">Record a few signals, then generate a draft. The draft is rule-based — it ranks and summarises stored data; it does not write new claims.</EmptyState>
            ) : (
              <div className="space-y-5">
                <BriefView brief={latest} />
                <div className="border-t border-line pt-4">
                  <ActionForm action={reviewBrief.bind(null, latest.id)} submitLabel="Save review">
                    <TextArea name="whyItMatters" label="Why it matters (edit before approving)" defaultValue={latest.whyItMatters} rows={2} />
                    <TextArea name="learnings" label="Learnings" defaultValue={latest.learnings} rows={2} />
                    <Select
                      name="status"
                      label="Status"
                      defaultValue={latest.status}
                      options={[
                        { value: "DRAFT", label: "Draft (staff only)" },
                        { value: "APPROVED", label: "Approved (staff only)" },
                        { value: "SHARED", label: "Shared with operator portal" },
                      ]}
                    />
                  </ActionForm>
                </div>
              </div>
            )}
            {op.briefs.length > 1 && (
              <div className="mt-5 border-t border-line pt-3 text-xs text-muted">
                Earlier briefs: {op.briefs.slice(1).map((b) => `${formatDate(b.weekOf)} (${b.status.toLowerCase()})`).join(" · ")}
              </div>
            )}
          </Card>

          <Card title="Signals" description="Atomic evidence. Label each by claim type so facts are never confused with guesses." padded={false}>
            {op.signals.length === 0 ? (
              <div className="p-5"><EmptyState title="No signals recorded" /></div>
            ) : (
              <Table>
                <thead><tr><th>Signal</th><th>Claim</th><th>Source</th><th>Date</th></tr></thead>
                <tbody>
                  {op.signals.map((s) => (
                    <tr key={s.id}>
                      <td className="min-w-[16rem]">
                        <p className="font-medium">{s.title}</p>
                        <p className="text-xs text-muted">{s.summary}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <Badge tone="outline">{s.type.toLowerCase()}</Badge>
                          <Badge>{CONFIDENCE_LABELS[s.confidence]} confidence</Badge>
                          {s.submittedByOperator && <Badge tone="info">From operator</Badge>}
                          {s.isIllustrative && <Badge tone="warning">Illustrative</Badge>}
                        </div>
                      </td>
                      <td><ClaimBadge c={s.claimType} /></td>
                      <td className="text-xs text-muted">{s.source}</td>
                      <td className="whitespace-nowrap text-xs text-muted">{formatDate(s.sourceTimestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            <details className="border-t border-line p-5">
              <summary className="cursor-pointer text-sm font-medium text-accent">Record a signal</summary>
              <div className="mt-4">
                <ActionForm action={addSignal.bind(null, op.id)} submitLabel="Record signal" resetOnSuccess>
                  <FormGrid cols={3}>
                    <Select name="type" label="Type" options={SIGNAL_TYPES} defaultValue="ENQUIRY" />
                    <Select name="claimType" label="Claim type" options={Object.entries(CLAIM_LABELS).map(([value, label]) => ({ value, label }))} defaultValue="OBSERVATION" />
                    <Select name="confidence" label="Confidence" options={options(CONFIDENCE_LABELS)} defaultValue="MEDIUM" />
                  </FormGrid>
                  <TextField name="title" label="Headline" required />
                  <TextArea name="summary" label="Summary" required rows={2} />
                  <TextArea name="evidence" label="Evidence" rows={2} />
                  <FormGrid cols={3}>
                    <TextField name="source" label="Source" required placeholder="e.g. Rezdy export, operator call" />
                    <TextField name="sourceTimestamp" label="Date of source" type="date" required defaultValue={toDateInput(new Date())} />
                    <Select name="visibility" label="Visible to" options={options(VISIBILITY_LABELS)} defaultValue="CONFIDENTIAL" />
                    <Select name="momentum" label="Momentum" options={["DECLINING", "STABLE", "RISING"].map((v) => ({ value: v, label: v.toLowerCase() }))} placeholder="—" />
                    <Select name="commercialPotential" label="Commercial potential" options={["LOW", "MEDIUM", "HIGH"].map((v) => ({ value: v, label: v.toLowerCase() }))} placeholder="—" />
                    {op.competitors.length > 0 && (
                      <Select name="competitorId" label="Competitor (if applicable)" options={op.competitors.map((c) => ({ value: c.id, label: c.name }))} placeholder="—" />
                    )}
                  </FormGrid>
                </ActionForm>
              </div>
            </details>
          </Card>

          <Card title="Content briefs" description="Based on demand, commercial intent, SEO/AI-discovery opportunity or a competitive gap — never generated just because a topic is trending." padded={false}>
            {op.contentBriefs.length === 0 ? (
              <div className="p-5"><EmptyState title="No content briefs yet" /></div>
            ) : (
              <Table>
                <thead><tr><th>Brief</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {op.contentBriefs.map((b) => (
                    <tr key={b.id}>
                      <td className="min-w-[16rem]">
                        <p className="font-medium">{b.title}</p>
                        <p className="text-xs text-muted">{CONTENT_TYPE_LABELS[b.contentType]} · {b.targetAudience}</p>
                        <p className="mt-1 text-xs text-muted">{b.whyNow}</p>
                      </td>
                      <td><Badge tone={b.status === "PUBLISHED" ? "success" : b.status === "REJECTED" ? "outline" : "info"}>{CONTENT_BRIEF_STATUS_LABELS[b.status]}</Badge></td>
                      <td className="whitespace-nowrap">
                        {CONTENT_BRIEF_TRANSITIONS[b.status]?.map((t) => (
                          <ActionForm key={t.next} action={transitionContentBrief.bind(null, op.id, b.id, t.next)} submitLabel={t.label} inline variant={t.next === "REJECTED" ? "danger" : "secondary"} />
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            <details className="border-t border-line p-5">
              <summary className="cursor-pointer text-sm font-medium text-accent">Propose a content brief</summary>
              <div className="mt-4">
                <ActionForm action={addContentBrief.bind(null, op.id)} submitLabel="Propose brief" resetOnSuccess>
                  <FormGrid cols={2}>
                    <Select name="contentType" label="Content type" options={options(CONTENT_TYPE_LABELS)} defaultValue="LANDING_PAGE" />
                    <TextField name="targetAudience" label="Target audience" required />
                  </FormGrid>
                  <TextField name="title" label="Title" required />
                  <TextArea name="whyNow" label="Why now" required rows={2} />
                  <TextArea name="keyPoints" label="Key points (one per line)" rows={3} />
                  <FormGrid cols={2}>
                    <TextField name="seoNotes" label="SEO notes" />
                    <TextField name="aiDiscoveryNotes" label="AI discovery notes" />
                  </FormGrid>
                </ActionForm>
              </div>
            </details>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Website profile" description="LLM-extracted from the operator's own site. Never populated without ANTHROPIC_API_KEY configured; nothing here is invented.">
            {!isLLMConfigured() ? (
              <Notice tone="warning">ANTHROPIC_API_KEY is not configured — this feature is unavailable. No profile has been invented in its place.</Notice>
            ) : !op.websiteUrl ? (
              <Notice tone="info">Add a website URL to the operator&apos;s profile first.</Notice>
            ) : (
              <>
                {op.profile?.analysisStatus === "CONNECTED" && op.profile.analyzedAt ? (
                  <div className="space-y-2 text-sm">
                    <p className="text-xs text-muted">
                      Analysed {formatDate(op.profile.analyzedAt)} by {op.profile.analyzedBy}
                      {op.profile.analysisConfidence && <> · <Badge tone="outline">{CONFIDENCE_LABELS[op.profile.analysisConfidence]} confidence</Badge></>}
                    </p>
                    {op.profile.positioning && <p>{op.profile.positioning}</p>}
                    {op.profile.differentiators.length > 0 && (
                      <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted">
                        {op.profile.differentiators.map((d, i) => <li key={i}>{d}</li>)}
                      </ul>
                    )}
                  </div>
                ) : op.profile?.analysisStatus === "FAILED" ? (
                  <Notice tone="danger">Last analysis failed: {op.profile.analysisError}</Notice>
                ) : (
                  <EmptyState title="Not analysed yet" />
                )}
                <div className="mt-4 border-t border-line pt-4">
                  <ActionForm action={analyzeOperatorWebsite.bind(null, op.id)} submitLabel={op.profile?.analyzedAt ? "Re-analyse website" : "Analyse website"} variant="secondary" />
                </div>
              </>
            )}
          </Card>

          <Card title="Competitors" description="Named competitors this operator's signals can be attributed to.">
            {op.competitors.length === 0 ? (
              <EmptyState title="No competitors recorded" />
            ) : (
              <ul className="space-y-3">
                {op.competitors.map((c) => (
                  <li key={c.id} className="flex items-start justify-between gap-2 border-t border-line pt-3 first:border-t-0 first:pt-0">
                    <div>
                      <p className="text-sm font-medium">{c.name}</p>
                      {c.websiteUrl && <p className="text-xs text-muted">{c.websiteUrl}</p>}
                      {c.notes && <p className="mt-0.5 text-xs text-muted">{c.notes}</p>}
                    </div>
                    <ActionForm action={removeCompetitor.bind(null, op.id, c.id)} submitLabel="Remove" inline variant="ghost" confirm={`Remove ${c.name}?`} />
                  </li>
                ))}
              </ul>
            )}
            <details className="mt-4 border-t border-line pt-3">
              <summary className="cursor-pointer text-xs text-accent">Add a competitor</summary>
              <div className="mt-2">
                <ActionForm action={addCompetitor.bind(null, op.id)} submitLabel="Add" resetOnSuccess>
                  <TextField name="name" label="Name" required />
                  <TextField name="websiteUrl" label="Website" placeholder="https://" />
                  <TextArea name="notes" label="Notes" rows={2} />
                </ActionForm>
              </div>
            </details>
          </Card>

          <Card title="Data sources" description="Pilot default is manual export. Nothing is marked connected until a tested sync is recorded.">
            <Notice tone="info">No live operator integrations are built in phase 1. This records how each source is obtained.</Notice>
            <ul className="mt-4 space-y-4">
              {INTEGRATION_REGISTRY.map((def) => {
                const row = op.integrations.find((i) => i.sourceKey === def.key);
                const status = effectiveStatus(def, row);
                return (
                  <li key={def.key} className="border-t border-line pt-3 first:border-t-0 first:pt-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{def.name}</p>
                      <Badge tone={status === "CONNECTED" ? "success" : status === "MANUAL_IMPORT" ? "info" : "outline"}>{INTEGRATION_STATUS_LABELS[status]}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">{def.pilotPath}</p>
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-accent">Update</summary>
                      <div className="mt-2">
                        <ActionForm action={setIntegration.bind(null, op.id, def.key)} submitLabel="Save">
                          <Select name="status" label="Status" options={options(INTEGRATION_STATUS_LABELS)} defaultValue={status} />
                          <TextField name="lastSyncedAt" label="Last tested sync" type="date" defaultValue={toDateInput(row?.lastSyncedAt)} />
                          <TextArea name="notes" label="Notes (no credentials)" defaultValue={row?.notes} rows={2} />
                        </ActionForm>
                        <p className="mt-1 text-xs text-subtle">Live integration would need: {def.requiresForLive}</p>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
