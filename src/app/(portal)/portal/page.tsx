import Link from "next/link";
import { ActionForm, Badge, ButtonLink, Card, DefinitionList, EmptyState, IllustrativeBadge, Notice, PageHeader, Select, Stat, Table, TextArea, TextField, WorkStatusBadge, ExperimentStatusBadge } from "@/components/ui";
import { BriefView } from "@/components/BriefView";
import { MoveCard, isDone } from "@/components/portal/MoveCard";
import { requireOperator } from "@/lib/auth/portal";
import { can } from "@/lib/auth/session";
import {
  portalAssessment, portalBriefs, portalBusiness, portalExperiments, portalMeasurements, portalOpportunities, portalProjects, portalTasks,
} from "@/lib/dal/portal";
import { roadmapOrder } from "@/lib/domain/prioritise";
import { compareMeasurements } from "@/lib/domain/results";
import { AREA_LABELS, METRIC_LABELS } from "@/lib/labels";
import { formatDate, formatNum, formatShortDate } from "@/lib/format";
import { submitSignal } from "./actions";
import { newLayoutEnabled } from "@/lib/brand";
import { LegacyPortalHome } from "./LegacyHome";

export default async function PortalHome() {
  if (!newLayoutEnabled()) return <LegacyPortalHome />;
  const { user, features } = await requireOperator();
  if (!features.includes("portal.dashboard")) {
    return (
      <div>
        <PageHeader eyebrow="Your portal" title="Your portal" description="The business dashboard isn't enabled for your business. Contact the programme team if you need it." />
      </div>
    );
  }
  const canSignal = features.includes("portal.signals") && can(user, "portal.signals");
  const actor = { id: user.id, role: user.role, operatorId: user.operatorId };
  const [biz, opps, tasks, projects, measurements, experiments, assessment, briefs] = await Promise.all([
    portalBusiness(actor), portalOpportunities(actor), portalTasks(actor), portalProjects(actor),
    portalMeasurements(actor), portalExperiments(actor), portalAssessment(actor), portalBriefs(actor),
  ]);
  const roadmap = roadmapOrder(opps.filter((o) => o.horizon !== "IGNORE" && o.status !== "REJECTED"));
  const nextMoves = roadmap.filter((o) => !isDone(o.status)).slice(0, 3);
  const results = compareMeasurements(measurements);
  const open = tasks.filter((t) => !["DONE", "CANCELLED"].includes(t.status));
  const doneTasks = tasks.filter((t) => t.status === "DONE").length;
  const liveTasks = tasks.filter((t) => t.status !== "CANCELLED").length;
  const runningExperiments = experiments.filter((e) => e.status === "RUNNING").length;

  return (
    <div>
      <PageHeader
        eyebrow={[biz.programme?.name, briefs[0] ? `Latest brief ${formatDate(briefs[0].weekOf)}` : null].filter(Boolean).join(" · ") || "Your business"}
        title={`${greeting()}, ${user.name.split(" ")[0]}.`}
        description={`${biz.name} — your plan, actions and results. Only you and the programme team can see your business information.`}
        actions={<><ButtonLink href="/portal/reports">Reports</ButtonLink><ButtonLink href="/portal/plan" variant="dark">See your plan →</ButtonLink></>}
      />
      {biz.isSynthetic && <div className="mb-6"><Notice tone="warning">Demo account: this is a synthetic business with illustrative data.</Notice></div>}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Actions done" value={<>{doneTasks}<span className="ml-1.5 text-base font-medium tracking-normal opacity-60">of {liveTasks}</span></>} sub={liveTasks ? `${open.length} still open` : "No actions yet"} variant="highlight" href="/portal/plan" />
        <Stat label="On your plan" value={roadmap.filter((o) => !isDone(o.status)).length} sub={`${roadmap.filter((o) => isDone(o.status)).length} done`} href="/portal/plan" />
        <Stat label="Experiments running" value={runningExperiments} sub={`${experiments.length} in total`} />
        <Stat label="Results tracked" value={results.length} sub={results.length ? "Baselines with a latest figure" : "No measurements yet"} />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card title="Your top 3 moves" actions={<Link href="/portal/plan" className="text-xs font-medium text-ink underline underline-offset-4">Full plan</Link>}>
          {nextMoves.length === 0 ? <EmptyState title="Your plan is being prepared">The programme team adds moves after your assessment.</EmptyState> : (
            <div className="space-y-3">{nextMoves.map((m, i) => <MoveCard key={m.id} move={m} index={i + 1} />)}</div>
          )}
        </Card>
        {briefs[0] ? (
          <Card title="This week's growth brief" description={`Reviewed by the programme team · week of ${formatDate(briefs[0].weekOf)}`} actions={<Link href="/portal/reports" className="text-xs font-medium text-ink underline underline-offset-4">All reports</Link>}>
            <BriefView brief={briefs[0]} />
          </Card>
        ) : (
          <Card title="This week's growth brief"><EmptyState title="No brief shared yet">Your first weekly brief appears here once the programme team has reviewed it.</EmptyState></Card>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Your actions" description={`${open.length} open`} padded={false}>
            {tasks.length === 0 ? <div className="p-5"><EmptyState title="No actions assigned yet" /></div> : (
              <Table>
                <thead><tr><th>Action</th><th>Due</th><th>Status</th></tr></thead>
                <tbody>
                  {tasks.map((t) => (
                    <tr key={t.id}>
                      <td><p className="font-medium">{t.title}</p>{t.project && <p className="text-xs text-muted">{t.project.title}</p>}</td>
                      <td className="text-muted">{formatShortDate(t.dueDate)}</td>
                      <td><WorkStatusBadge s={t.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
          <Card title="Baselines & results" padded={false}>
            {results.length === 0 ? <div className="p-5"><EmptyState title="No measurements yet" /></div> : (
              <Table>
                <thead><tr><th>Measure</th><th className="text-right">Baseline</th><th className="text-right">Latest</th><th /></tr></thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.key}>
                      <td>{r.label ?? METRIC_LABELS[r.metric]}<p className="text-xs text-subtle">{r.unit}</p></td>
                      <td className="text-right tabular-nums">{formatNum(r.baseline)}</td>
                      <td className="text-right tabular-nums">{formatNum(r.result)}</td>
                      <td>{r.illustrative && <IllustrativeBadge />}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
          {(projects.length > 0 || experiments.length > 0) && (
            <Card title="Projects & experiments" padded={false}>
              <Table>
                <tbody>
                  {projects.map((p) => <tr key={p.id}><td>{p.title}</td><td className="text-xs text-muted">Project</td><td><WorkStatusBadge s={p.status} /></td></tr>)}
                  {experiments.map((e) => <tr key={e.id}><td>{e.title}<p className="text-xs text-muted">{e.hypothesis}</p></td><td className="text-xs text-muted">Experiment</td><td><ExperimentStatusBadge s={e.status} /></td></tr>)}
                </tbody>
              </Table>
            </Card>
          )}
        </div>
        <div className="space-y-6">
          {canSignal && (
            <Card title="Tell us what you're seeing" description="Enquiries, reviews, busy or quiet periods — it feeds your weekly brief.">
              <ActionForm action={submitSignal} submitLabel="Send update" resetOnSuccess>
                <Select name="type" label="About" options={[{ value: "ENQUIRY", label: "Enquiries" }, { value: "REVIEW", label: "Reviews / feedback" }, { value: "DEMAND", label: "Bookings / demand" }, { value: "OPERATIONS", label: "Operations" }, { value: "MARKET", label: "Market / competitors" }]} defaultValue="ENQUIRY" />
                <TextField name="title" label="In one line" required />
                <TextArea name="summary" label="Details" required rows={3} hint="Please don't include guests' personal details." />
              </ActionForm>
            </Card>
          )}
          {assessment && (
            <Card title="Your assessment" description={formatDate(assessment.conductedAt)}>
              <p className="mb-3 text-sm">{assessment.summary}</p>
              <ul className="space-y-1 text-sm">
                {assessment.areas.map((a) => <li key={a.id} className="flex justify-between gap-2"><span className="text-muted">{AREA_LABELS[a.area]}</span><span className="tabular-nums">{a.score ? `${a.score}/5` : "—"}</span></li>)}
              </ul>
            </Card>
          )}
          <Card title="What you've agreed to share">
            <DefinitionList
              items={[
                { label: "Scope", value: biz.agreedScope },
                { label: "Data agreement", value: biz.dataAgreementSignedAt ? `Signed ${formatDate(biz.dataAgreementSignedAt)}` : "Not yet signed" },
                { label: "Sharing", value: <span className="flex flex-wrap gap-1"><Badge tone={biz.consentCohortSharing ? "success" : "outline"}>Cohort learnings</Badge><Badge tone={biz.consentAggregate ? "success" : "outline"}>Anonymised totals</Badge><Badge tone={biz.consentCaseStudy ? "success" : "outline"}>Public case study</Badge></span> },
                { label: "Retention", value: biz.dataRetentionNotes },
              ]}
            />
            <p className="mt-3 text-xs text-subtle">To change any of this, contact your programme lead. Corrections to your information are always welcome.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-NZ", { hour: "numeric", hour12: false, timeZone: "Pacific/Auckland" }).format(new Date()));
  return hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
}
