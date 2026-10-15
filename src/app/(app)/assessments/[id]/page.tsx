import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, ButtonLink, Card, Checkbox, EvidenceBadge, HorizonBadge, Notice, PageHeader, Select, Table, TextArea } from "@/components/ui";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { AREA_LABELS, ASSESSMENT_STATUS_LABELS, SOLUTION_LABELS, options } from "@/lib/labels";
import { priorityScore } from "@/lib/domain/prioritise";
import { saveAssessment } from "../actions";

const SCORE_OPTS = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} — ${["Weak", "Basic", "Adequate", "Good", "Strong"][n - 1]}` }));

export default async function AssessmentPage({ params }: PageProps<"/assessments/[id]">) {
  await requirePermission("assessments.view");
  const { id } = await params;
  const a = await prisma.assessment.findUnique({
    where: { id },
    include: { operator: true, areas: true, opportunities: { orderBy: { createdAt: "asc" } } },
  });
  if (!a) notFound();
  const areas = [...a.areas].sort((x, y) => Object.keys(AREA_LABELS).indexOf(x.area) - Object.keys(AREA_LABELS).indexOf(y.area));

  return (
    <div>
      <PageHeader
        eyebrow={<Link href={`/operators/${a.operator.id}`} className="hover:underline">{a.operator.name}</Link>}
        title="AI opportunity assessment"
        description={`Conducted by ${a.conductedBy ?? "—"}. Keep observed facts and operator-reported information separate; record opportunities as hypotheses until evidence supports them.`}
        actions={<ButtonLink href={`/opportunities/new?operatorId=${a.operatorId}&assessmentId=${a.id}`} variant="primary">Record opportunity</ButtonLink>}
      />
      {a.operator.culturalGuidance && (
        <div className="mb-6"><Notice tone="warning">Cultural guidance applies to this operator: {a.operator.culturalGuidance}</Notice></div>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <ActionForm action={saveAssessment.bind(null, a.id)} submitLabel="Save assessment">
              <div className="grid gap-4 sm:grid-cols-2">
                <Select name="status" label="Status" options={options(ASSESSMENT_STATUS_LABELS)} defaultValue={a.status} />
                <div className="flex items-end pb-2">
                  <Checkbox name="sharedWithOperator" label="Visible to the operator in their portal" defaultChecked={a.sharedWithOperator} />
                </div>
              </div>
              <TextArea name="summary" label="Summary" defaultValue={a.summary} rows={3} />
              {areas.map((ar) => (
                <fieldset key={ar.id} className="rounded-lg border border-line p-4">
                  <legend className="px-1 text-sm font-semibold text-ink">{AREA_LABELS[ar.area]}</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Select name={`${ar.area}.score`} label="Current capability" options={SCORE_OPTS} defaultValue={ar.score ? String(ar.score) : ""} placeholder="Not scored" />
                    <div />
                    <TextArea name={`${ar.area}.observed`} label="Observed (seen directly)" defaultValue={ar.observed} rows={2} />
                    <TextArea name={`${ar.area}.reported`} label="Operator-reported" defaultValue={ar.reported} rows={2} />
                  </div>
                  <div className="mt-3"><TextArea name={`${ar.area}.notes`} label="Notes / possible opportunity" defaultValue={ar.notes} rows={2} /></div>
                </fieldset>
              ))}
            </ActionForm>
          </Card>
        </div>
        <div>
          <Card title="Opportunities from this assessment" padded={false}>
            {a.opportunities.length === 0 ? (
              <p className="p-5 text-sm text-muted">None recorded yet. Not every weakness needs AI — a process fix or better website information is often the better answer.</p>
            ) : (
              <Table>
                <tbody>
                  {a.opportunities.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link href={`/opportunities/${o.id}`} className="font-medium hover:underline">{o.title}</Link>
                        <div className="mt-1 flex flex-wrap gap-1"><HorizonBadge h={o.horizon} /><EvidenceBadge k={o.evidenceBasis} /></div>
                        <p className="mt-1 text-xs text-muted">{SOLUTION_LABELS[o.solutionType]} · score {priorityScore(o)}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
