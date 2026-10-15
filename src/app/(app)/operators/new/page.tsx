import { Card, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth/session";
import { createOperator } from "../actions";
import { OperatorForm } from "../OperatorForm";

export default async function NewOperatorPage() {
  await requirePermission("operators.edit");
  return (
    <div>
      <PageHeader eyebrow="Operators" title="Add operator" description="Capture what you know now; everything can be edited later. Permissions are recorded on the operator page." />
      <Card>
        <OperatorForm action={createOperator} submitLabel="Create operator" />
      </Card>
    </div>
  );
}
