import { ActionForm, FormGrid, Select, TextField } from "@/components/ui";
import { createTask } from "@/app/(app)/work/actions";
import { HORIZON_LABELS, VISIBILITY_LABELS, options } from "@/lib/labels";

export function TaskQuickAdd({
  operatorId,
  projectId,
  initiativeId,
  workshopId,
  operatorOpts,
  staffOpts,
}: {
  operatorId?: string;
  projectId?: string;
  initiativeId?: string;
  workshopId?: string;
  operatorOpts?: { value: string; label: string }[];
  staffOpts: { value: string; label: string }[];
}) {
  return (
    <ActionForm action={createTask} submitLabel="Add task" resetOnSuccess>
      {operatorId && <input type="hidden" name="operatorId" value={operatorId} />}
      {projectId && <input type="hidden" name="projectId" value={projectId} />}
      {initiativeId && <input type="hidden" name="initiativeId" value={initiativeId} />}
      {workshopId && <input type="hidden" name="workshopId" value={workshopId} />}
      <FormGrid cols={3}>
        <TextField name="title" label="Task" required className="sm:col-span-2 lg:col-span-3" />
        {operatorOpts && <Select name="operatorId" label="Operator" options={operatorOpts} placeholder="Programme-level" />}
        <Select name="assigneeId" label="Assigned to (staff)" options={staffOpts} placeholder="—" />
        <TextField name="ownerLabel" label="Or owner (non-user)" placeholder="e.g. Operator: Jo" />
        <TextField name="dueDate" label="Due" type="date" />
        <Select name="priority" label="Priority" options={options(HORIZON_LABELS)} defaultValue="NOW" />
        <Select name="visibility" label="Visible to" options={options(VISIBILITY_LABELS)} defaultValue={initiativeId ? "CONFIDENTIAL" : "INTERNAL"} />
      </FormGrid>
    </ActionForm>
  );
}
