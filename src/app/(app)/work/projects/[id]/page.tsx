import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, PageHeader, WorkStatusBadge } from "@/components/ui";
import { EvidencePanel } from "@/components/EvidencePanel";
import { TaskList } from "@/components/TaskList";
import { TaskQuickAdd } from "@/components/TaskQuickAdd";
import { can, requirePermission } from "@/lib/auth/session";
import { ClientVisibilityToggle } from "@/components/ClientVisibilityToggle";
import { prisma } from "@/lib/prisma";
import { initiativeOptions, operatorOptions, staffOptions } from "@/lib/queries";
import { opportunityOptions } from "@/lib/opportunityOptions";
import { updateProject } from "../../actions";
import { ProjectForm } from "../../ProjectForm";

export default async function ProjectPage({ params }: PageProps<"/work/projects/[id]">) {
  const user = await requirePermission("work.view");
  const { id } = await params;
  const p = await prisma.project.findUnique({
    where: { id },
    include: {
      operator: { select: { id: true, name: true } },
      opportunity: { select: { id: true, title: true } },
      initiative: { select: { id: true, title: true } },
      tasks: { orderBy: [{ status: "asc" }, { dueDate: "asc" }], include: { assignee: { select: { name: true } }, operator: { select: { id: true, name: true } } } },
    },
  });
  if (!p) notFound();
  const [operatorOpts, initiativeOpts, opportunityOpts, staffOpts] = await Promise.all([operatorOptions(), initiativeOptions(), opportunityOptions(), staffOptions()]);
  const done = p.tasks.filter((t) => t.status === "DONE").length;

  return (
    <div>
      <PageHeader
        eyebrow={p.operator ? <Link href={`/operators/${p.operator.id}`} className="hover:underline">{p.operator.name}</Link> : p.initiative ? <Link href={`/collective/initiatives/${p.initiative.id}`} className="hover:underline">{p.initiative.title}</Link> : "Project"}
        title={p.title}
        description={<span className="flex flex-wrap items-center gap-1.5"><WorkStatusBadge s={p.status} /><ClientVisibilityToggle kind="project" id={p.id} visibility={p.visibility} operatorId={p.operatorId} editable={can(user, "work.edit")} />{p.opportunity && <Link href={`/opportunities/${p.opportunity.id}`} className="text-xs text-accent hover:underline">From: {p.opportunity.title}</Link>}</span>}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Tasks" description={`${done}/${p.tasks.length} done`}>
            <TaskList tasks={p.tasks} showOperator={!p.operatorId} clientVisibility={can(user, "work.edit") ? "edit" : "show"} />
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-accent">Add task</summary>
              <div className="mt-3"><TaskQuickAdd projectId={p.id} operatorId={p.operatorId ?? undefined} initiativeId={p.initiativeId ?? undefined} staffOpts={staffOpts} /></div>
            </details>
          </Card>
          <Card title="Project details">
            <ProjectForm action={updateProject.bind(null, p.id)} p={p} operatorOpts={operatorOpts} initiativeOpts={initiativeOpts} opportunityOpts={opportunityOpts} submitLabel="Save project" />
          </Card>
        </div>
        <div><EvidencePanel entityType="project" entityId={p.id} operatorId={p.operatorId} path={`/work/projects/${p.id}`} /></div>
      </div>
    </div>
  );
}
