import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { updateOperator } from "../../actions";
import { OperatorForm } from "../../OperatorForm";

export default async function EditOperatorPage({ params }: PageProps<"/operators/[id]/edit">) {
  await requirePermission("operators.edit");
  const { id } = await params;
  const op = await prisma.operator.findUnique({ where: { id } });
  if (!op) notFound();
  return (
    <div>
      <PageHeader eyebrow={op.name} title="Edit operator profile" />
      <Card>
        <OperatorForm action={updateOperator.bind(null, id)} op={op} submitLabel="Save changes" />
      </Card>
    </div>
  );
}
