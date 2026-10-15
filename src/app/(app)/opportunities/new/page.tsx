import { Card, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { initiativeOptions, operatorOptions, staffOptions } from "@/lib/queries";
import { createOpportunity } from "../actions";
import { OpportunityForm } from "../OpportunityForm";

export default async function NewOpportunityPage({ searchParams }: PageProps<"/opportunities/new">) {
  await requirePermission("opportunities.edit");
  const sp = await searchParams;
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const [operatorOpts, initiativeOpts, staffOpts, templates] = await Promise.all([
    operatorOptions(), initiativeOptions(), staffOptions(),
    prisma.solutionTemplate.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <div>
      <PageHeader eyebrow="Opportunity register" title="Record an opportunity" description="Distinguish what you observed from what the operator told you, and from what you are guessing." />
      <Card>
        <OpportunityForm
          action={createOpportunity}
          defaults={{ operatorId: s("operatorId"), assessmentId: s("assessmentId"), initiativeId: s("initiativeId"), templateId: s("templateId") }}
          operatorOpts={operatorOpts}
          initiativeOpts={initiativeOpts}
          staffOpts={staffOpts}
          templateOpts={templates.map((t) => ({ value: t.id, label: t.name }))}
          submitLabel="Create opportunity"
        />
      </Card>
    </div>
  );
}
