import type { Project } from "@/generated/prisma";
import { ActionForm, FormGrid, Select, TextArea, TextField } from "@/components/ui";
import type { ActionState } from "@/lib/forms";
import { VISIBILITY_LABELS, WORK_STATUS_LABELS, options } from "@/lib/labels";
import { toDateInput } from "@/lib/format";

type Opt = { value: string; label: string };

export function ProjectForm({
  action, p, defaults, operatorOpts, initiativeOpts, opportunityOpts, submitLabel,
}: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  p?: Project;
  defaults?: { operatorId?: string; opportunityId?: string; initiativeId?: string };
  operatorOpts: Opt[];
  initiativeOpts: Opt[];
  opportunityOpts: Opt[];
  submitLabel: string;
}) {
  return (
    <ActionForm action={action} submitLabel={submitLabel}>
      <FormGrid>
        <TextField name="title" label="Project" required defaultValue={p?.title} className="sm:col-span-2" />
        <Select name="operatorId" label="Operator" options={operatorOpts} defaultValue={p?.operatorId ?? defaults?.operatorId} placeholder="— none —" />
        <Select name="initiativeId" label="Shared initiative" options={initiativeOpts} defaultValue={p?.initiativeId ?? defaults?.initiativeId} placeholder="—" />
        <Select name="opportunityId" label="From opportunity" options={opportunityOpts} defaultValue={p?.opportunityId ?? defaults?.opportunityId} placeholder="—" />
        <Select name="status" label="Status" options={options(WORK_STATUS_LABELS)} defaultValue={p?.status ?? "TODO"} />
        <TextField name="startDate" label="Start" type="date" defaultValue={toDateInput(p?.startDate)} />
        <TextField name="dueDate" label="Due" type="date" defaultValue={toDateInput(p?.dueDate)} />
        <TextField name="tools" label="Tools" defaultValue={p?.tools.join(", ")} />
        <Select name="visibility" label="Visible to" options={options(VISIBILITY_LABELS)} defaultValue={p?.visibility ?? "INTERNAL"} hint="New projects stay staff only until you show them to the business." />
        <TextField name="oneOffCostNzd" label="One-off cost (NZD)" type="number" defaultValue={p?.oneOffCostNzd} />
        <TextField name="monthlyCostNzd" label="Monthly cost (NZD)" type="number" defaultValue={p?.monthlyCostNzd} />
      </FormGrid>
      <TextArea name="description" label="Description" defaultValue={p?.description} />
      <TextArea name="testingNotes" label="Testing notes" defaultValue={p?.testingNotes} hint="What was tested, by whom, and what changed as a result." />
      <FormGrid cols={3}>
        <TextField name="approvedBy" label="Go-live approved by" defaultValue={p?.approvedBy} hint="Human approval record" />
        <TextField name="approvedAt" label="Approved on" type="date" defaultValue={toDateInput(p?.approvedAt)} />
        <TextField name="adoption" label="Adoption" defaultValue={p?.adoption} placeholder="not started / partial / embedded" />
      </FormGrid>
    </ActionForm>
  );
}
