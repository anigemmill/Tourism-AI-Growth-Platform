import type { Opportunity } from "@/generated/prisma";
import { ActionForm, FormGrid, FormSection, Select, TextArea, TextField } from "@/components/ui";
import type { ActionState } from "@/lib/forms";
import {
  AREA_LABELS, CONFIDENCE_LABELS, EVIDENCE_LABELS, HORIZON_LABELS, OPP_STATUS_LABELS, SOLUTION_LABELS, VISIBILITY_LABELS, options,
} from "@/lib/labels";

type Opt = { value: string; label: string };
const SCORE = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }));

export function OpportunityForm({
  action, o, defaults, operatorOpts, initiativeOpts, staffOpts, templateOpts, submitLabel,
}: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  o?: Opportunity;
  defaults?: Partial<Record<"operatorId" | "assessmentId" | "initiativeId" | "templateId" | "area", string>>;
  operatorOpts: Opt[];
  initiativeOpts: Opt[];
  staffOpts: Opt[];
  templateOpts: Opt[];
  submitLabel: string;
}) {
  return (
    <ActionForm action={action} submitLabel={submitLabel}>
      {(o?.assessmentId ?? defaults?.assessmentId) && <input type="hidden" name="assessmentId" value={o?.assessmentId ?? defaults?.assessmentId} />}
      <FormSection title="What and for whom">
        <FormGrid>
          <TextField name="title" label="Title" required defaultValue={o?.title} className="sm:col-span-2" />
          <Select name="operatorId" label="Operator" options={operatorOpts} defaultValue={o?.operatorId ?? defaults?.operatorId} placeholder="— Shared initiative —" />
          <Select name="initiativeId" label="Shared initiative" options={initiativeOpts} defaultValue={o?.initiativeId ?? defaults?.initiativeId} placeholder="—" />
          <Select name="area" label="Assessment area" required options={options(AREA_LABELS)} defaultValue={o?.area ?? defaults?.area} placeholder="Choose…" />
          <Select name="solutionType" label="Type of solution" required options={options(SOLUTION_LABELS)} defaultValue={o?.solutionType} placeholder="Choose…" hint="Not everything needs AI. Prefer the simplest thing that works." />
          <Select name="templateId" label="Based on template" options={templateOpts} defaultValue={o?.templateId ?? defaults?.templateId} placeholder="—" />
          <Select name="ownerId" label="Owner" options={staffOpts} defaultValue={o?.ownerId} placeholder="—" />
        </FormGrid>
      </FormSection>
      <FormSection title="Problem and proposal">
        <div className="grid gap-4">
          <TextArea name="problem" label="Business problem" required defaultValue={o?.problem} />
          <TextArea name="currentProcess" label="Current process" defaultValue={o?.currentProcess} />
          <TextArea name="proposedSolution" label="Proposed improvement" required defaultValue={o?.proposedSolution} />
          <TextArea name="expectedValue" label="Expected business value" defaultValue={o?.expectedValue} />
        </div>
      </FormSection>
      <FormSection title="Effort, cost and dependencies" description="NZD excl. GST.">
        <FormGrid cols={3}>
          <TextField name="expectedValueNzd" label="Annual value estimate (NZD)" type="number" defaultValue={o?.expectedValueNzd} />
          <TextField name="oneOffCostNzd" label="One-off cost (NZD)" type="number" defaultValue={o?.oneOffCostNzd} />
          <TextField name="monthlyCostNzd" label="Ongoing cost / month (NZD)" type="number" defaultValue={o?.monthlyCostNzd} />
          <TextField name="effortHours" label="Effort (hours)" type="number" step="1" defaultValue={o?.effortHours} />
          <TextField name="tools" label="Tools / integrations" defaultValue={o?.tools.join(", ")} className="sm:col-span-2" />
        </FormGrid>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <TextArea name="dataRequirements" label="Data & integration requirements" defaultValue={o?.dataRequirements} rows={2} />
          <TextArea name="risks" label="Risks" defaultValue={o?.risks} rows={2} />
          <TextArea name="dependencies" label="Dependencies" defaultValue={o?.dependencies} rows={2} />
        </div>
      </FormSection>
      <FormSection title="Measurement">
        <FormGrid cols={3}>
          <TextField name="successMetric" label="Success metric" defaultValue={o?.successMetric} />
          <TextField name="baselineMetric" label="Baseline" defaultValue={o?.baselineMetric} />
          <TextField name="targetMetric" label="Target" defaultValue={o?.targetMetric} />
        </FormGrid>
        <div className="mt-4"><TextArea name="actualResult" label="Actual result" defaultValue={o?.actualResult} rows={2} /></div>
      </FormSection>
      <FormSection title="Prioritisation" description="Score = impact ÷ effort × confidence. Horizon is your call.">
        <FormGrid cols={3}>
          <Select name="impactScore" label="Impact (1–5)" options={SCORE} defaultValue={String(o?.impactScore ?? 3)} />
          <Select name="effortScore" label="Effort (1 low – 5 high)" options={SCORE} defaultValue={String(o?.effortScore ?? 3)} />
          <Select name="confidence" label="Confidence" options={options(CONFIDENCE_LABELS)} defaultValue={o?.confidence ?? "MEDIUM"} />
          <Select name="evidenceBasis" label="Basis of recommendation" options={options(EVIDENCE_LABELS)} defaultValue={o?.evidenceBasis ?? "HYPOTHESIS"} />
          <Select name="horizon" label="Horizon" options={options(HORIZON_LABELS)} defaultValue={o?.horizon ?? "NEXT"} />
          <Select name="status" label="Status" options={options(OPP_STATUS_LABELS)} defaultValue={o?.status ?? "IDENTIFIED"} />
          <Select name="visibility" label="Visible to" options={options(VISIBILITY_LABELS)} defaultValue={o?.visibility ?? "INTERNAL"} hint="New items stay staff only until you show them to the business. Sharing beyond the business needs its recorded consent." />
        </FormGrid>
      </FormSection>
    </ActionForm>
  );
}
