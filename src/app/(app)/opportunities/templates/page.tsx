import { ActionForm, Badge, Card, EmptyState, FormGrid, PageHeader, Select, TextArea, TextField } from "@/components/ui";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { AREA_LABELS, SOLUTION_LABELS, options } from "@/lib/labels";
import { formatNzd } from "@/lib/format";
import { applyTemplate, createTemplate } from "../actions";

export default async function TemplatesPage() {
  await requirePermission("opportunities.view");
  const [templates, operators, assets] = await Promise.all([
    prisma.solutionTemplate.findMany({ orderBy: { name: "asc" }, include: { workflowAsset: { select: { name: true, status: true } }, _count: { select: { opportunities: true } } } }),
    prisma.operator.findMany({ where: { status: { notIn: ["WITHDRAWN"] } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.workflowAsset.findMany({ select: { id: true, name: true } }),
  ]);
  return (
    <div>
      <PageHeader eyebrow="Opportunity register" title="Reusable solution templates" description="Implement a proven workflow for several operators without starting from scratch. Applying a template creates a hypothesis-stage opportunity for each operator to confirm." />
      <div className="space-y-4">
        {templates.length === 0 && <EmptyState title="No templates yet" />}
        {templates.map((t) => (
          <Card key={t.id} title={t.name} description={`${AREA_LABELS[t.area]} · ${SOLUTION_LABELS[t.solutionType]} · used ${t._count.opportunities}×`}>
            <p className="text-sm">{t.description}</p>
            {t.steps && <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-surface-2 p-3 font-sans text-xs text-muted">{t.steps}</pre>}
            <p className="mt-3 text-xs text-muted">
              Typical: {t.typicalEffortHours ?? "—"} h · {formatNzd(t.typicalOneOffNzd)} one-off · {formatNzd(t.typicalMonthlyNzd)}/mo · Tools: {t.tools.join(", ") || "—"}
              {t.workflowAsset && <> · Workflow: <Badge>{t.workflowAsset.name} ({t.workflowAsset.status.toLowerCase()})</Badge></>}
            </p>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-accent">Apply to operators</summary>
              <div className="mt-3">
                <ActionForm action={applyTemplate.bind(null, t.id)} submitLabel="Create opportunities">
                  <fieldset className="grid gap-1.5 sm:grid-cols-2">
                    <legend className="mb-1 text-xs font-medium text-muted">Operators</legend>
                    {operators.map((o) => (
                      <label key={o.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="operatorIds" value={o.id} className="accent-[var(--brand)]" /> {o.name}</label>
                    ))}
                  </fieldset>
                </ActionForm>
              </div>
            </details>
          </Card>
        ))}
        <Card title="New template">
          <ActionForm action={createTemplate} submitLabel="Save template" resetOnSuccess>
            <FormGrid>
              <TextField name="name" label="Name" required />
              <Select name="area" label="Area" required options={options(AREA_LABELS)} placeholder="Choose…" />
              <Select name="solutionType" label="Solution type" required options={options(SOLUTION_LABELS)} placeholder="Choose…" />
              <Select name="workflowAssetId" label="Linked workflow" options={assets.map((a) => ({ value: a.id, label: a.name }))} placeholder="—" />
            </FormGrid>
            <TextArea name="description" label="Description" required />
            <TextArea name="steps" label="Implementation steps" rows={4} />
            <FormGrid cols={3}>
              <TextField name="typicalEffortHours" label="Typical hours" type="number" step="1" />
              <TextField name="typicalOneOffNzd" label="Typical one-off (NZD)" type="number" />
              <TextField name="typicalMonthlyNzd" label="Typical monthly (NZD)" type="number" />
              <TextField name="tools" label="Tools" />
              <TextField name="successMetric" label="Success metric" className="sm:col-span-2" />
            </FormGrid>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
