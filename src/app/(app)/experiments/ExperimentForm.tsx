import type { Experiment } from "@/generated/prisma";
import { ActionForm, Checkbox, FormGrid, FormSection, Select, TextArea, TextField } from "@/components/ui";
import type { ActionState } from "@/lib/forms";
import { COMPARISON_LABELS, DECISION_LABELS, EXPERIMENT_STATUS_LABELS, METRIC_LABELS, VISIBILITY_LABELS, options } from "@/lib/labels";
import { toDateInput } from "@/lib/format";

type Opt = { value: string; label: string };

export function ExperimentForm({
  action, e, defaults, operatorOpts, initiativeOpts, opportunityOpts, experimentOpts, submitLabel,
}: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  e?: Experiment;
  defaults?: { operatorId?: string; initiativeId?: string; opportunityId?: string };
  operatorOpts: Opt[];
  initiativeOpts: Opt[];
  opportunityOpts: Opt[];
  experimentOpts: Opt[];
  submitLabel: string;
}) {
  return (
    <ActionForm action={action} submitLabel={submitLabel}>
      <FormSection title="Design" description="Write the hypothesis and thresholds before the experiment starts.">
        <FormGrid>
          <TextField name="title" label="Title" required defaultValue={e?.title} className="sm:col-span-2" />
          <Select name="operatorId" label="Operator" options={operatorOpts} defaultValue={e?.operatorId ?? defaults?.operatorId} placeholder="—" />
          <Select name="initiativeId" label="Shared initiative" options={initiativeOpts} defaultValue={e?.initiativeId ?? defaults?.initiativeId} placeholder="—" />
          <Select name="opportunityId" label="Tests opportunity" options={opportunityOpts} defaultValue={e?.opportunityId ?? defaults?.opportunityId} placeholder="—" />
          <Select name="supersedesId" label="Re-run of earlier experiment" options={experimentOpts} defaultValue={e?.supersedesId} placeholder="—" />
        </FormGrid>
        <div className="mt-4 grid gap-4">
          <Checkbox name="isDestinationLevel" label="Destination-level experiment (track incremental visitors, nights and spend separately)" defaultChecked={e?.isDestinationLevel} />
          <TextArea name="changeFromPrevious" label="What is different from the earlier experiment?" defaultValue={e?.changeFromPrevious} rows={2} />
          <TextArea name="hypothesis" label="Hypothesis" required defaultValue={e?.hypothesis} placeholder="If we … then … will change by … because …" />
          <TextArea name="problem" label="Business problem" required defaultValue={e?.problem} rows={2} />
          <TextField name="audience" label="Target audience" defaultValue={e?.audience} />
          <TextArea name="intervention" label="Intervention / change being tested" required defaultValue={e?.intervention} rows={2} />
        </div>
      </FormSection>
      <FormSection title="Timing & comparison">
        <FormGrid cols={3}>
          <TextField name="startDate" label="Start" type="date" defaultValue={toDateInput(e?.startDate)} />
          <TextField name="endDate" label="End" type="date" defaultValue={toDateInput(e?.endDate)} />
          <Select name="comparisonMethod" label="Comparison method" options={options(COMPARISON_LABELS)} defaultValue={e?.comparisonMethod ?? "BEFORE_AFTER"} />
          <TextField name="baselineStart" label="Baseline period start" type="date" defaultValue={toDateInput(e?.baselineStart)} />
          <TextField name="baselineEnd" label="Baseline period end" type="date" defaultValue={toDateInput(e?.baselineEnd)} />
        </FormGrid>
      </FormSection>
      <FormSection title="Metrics & thresholds">
        <FormGrid cols={3}>
          <Select name="primaryMetric" label="Primary metric" required options={options(METRIC_LABELS)} defaultValue={e?.primaryMetric} placeholder="Choose…" />
          <TextField name="primaryMetricLabel" label="Metric detail" defaultValue={e?.primaryMetricLabel} />
          <TextField name="secondaryMetrics" label="Secondary metrics" defaultValue={e?.secondaryMetrics.join(", ")} />
          <TextField name="baselineValue" label="Baseline value" type="number" defaultValue={e?.baselineValue} />
          <TextField name="targetValue" label="Target" type="number" defaultValue={e?.targetValue} />
          <TextField name="minimumAcceptable" label="Minimum acceptable result" type="number" defaultValue={e?.minimumAcceptable} />
          <TextField name="maxCostNzd" label="Maximum acceptable cost (NZD)" type="number" defaultValue={e?.maxCostNzd} />
        </FormGrid>
        <div className="mt-4"><Checkbox name="higherIsBetter" label="Higher is better for the primary metric" defaultChecked={e?.higherIsBetter ?? true} /></div>
      </FormSection>
      <FormSection title="Results" description="Do not treat AI mentions, traffic or total bookings as proof of incremental impact.">
        <FormGrid cols={3}>
          <TextField name="actualValue" label="Actual result" type="number" defaultValue={e?.actualValue} />
          <TextField name="controlValue" label="Control / comparison result" type="number" defaultValue={e?.controlValue} />
          <TextField name="actualCostNzd" label="Actual cost (NZD)" type="number" defaultValue={e?.actualCostNzd} />
          <TextField name="incrementalVisitors" label="Incremental visitors" type="number" defaultValue={e?.incrementalVisitors} hint="Destination-level only" />
          <TextField name="incrementalGuestNights" label="Incremental guest nights" type="number" defaultValue={e?.incrementalGuestNights} />
          <TextField name="incrementalSpendNzd" label="Incremental local spend (NZD)" type="number" defaultValue={e?.incrementalSpendNzd} />
        </FormGrid>
        <div className="mt-4 grid gap-4">
          <TextArea name="resultSummary" label="Result summary" defaultValue={e?.resultSummary} rows={2} />
          <TextArea name="limitations" label="Limitations" defaultValue={e?.limitations} rows={2} />
          <TextArea name="attributionNotes" label="Attribution limitations" defaultValue={e?.attributionNotes} rows={2} />
        </div>
      </FormSection>
      <FormSection title="Decision">
        <FormGrid cols={3}>
          <Select name="status" label="Status" options={options(EXPERIMENT_STATUS_LABELS)} defaultValue={e?.status ?? "DESIGN"} />
          <Select name="decision" label="Decision" options={options(DECISION_LABELS)} defaultValue={e?.decision} placeholder="—" />
          <Select name="visibility" label="Visible to" options={options(VISIBILITY_LABELS)} defaultValue={e?.visibility ?? "INTERNAL"} />
        </FormGrid>
        <div className="mt-4"><TextArea name="nextAction" label="Next action" defaultValue={e?.nextAction} rows={2} /></div>
      </FormSection>
    </ActionForm>
  );
}
