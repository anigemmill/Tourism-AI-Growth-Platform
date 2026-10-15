import Link from "next/link";
import type { Prisma } from "@/generated/prisma";
import { ButtonLink, Card, EmptyState, PageHeader, Progress, Table, Tabs, WorkStatusBadge } from "@/components/ui";
import { TaskList } from "@/components/TaskList";
import { TaskQuickAdd } from "@/components/TaskQuickAdd";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { operatorOptions, staffOptions } from "@/lib/queries";
import { formatDate } from "@/lib/format";

const OPEN = ["TODO", "IN_PROGRESS", "BLOCKED"] as const;

export default async function WorkPage({ searchParams }: PageProps<"/work">) {
  const user = await requirePermission("work.view");
  const view = String((await searchParams).view ?? "open");
  const now = new Date();
  const where: Prisma.TaskWhereInput =
    view === "overdue" ? { status: { in: [...OPEN] }, dueDate: { lt: now } }
    : view === "mine" ? { status: { in: [...OPEN] }, assigneeId: user.id }
    : view === "blocked" ? { status: "BLOCKED" }
    : view === "done" ? { status: "DONE" }
    : { status: { in: [...OPEN] } };

  const [tasks, projects, operatorOpts, staffOpts, overdue] = await Promise.all([
    prisma.task.findMany({
      where,
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }],
      take: 200,
      include: { operator: { select: { id: true, name: true } }, assignee: { select: { name: true } }, project: { select: { id: true, title: true } } },
    }),
    prisma.project.findMany({
      where: { status: { notIn: ["DONE", "CANCELLED"] } },
      orderBy: { dueDate: { sort: "asc", nulls: "last" } },
      include: { operator: { select: { name: true } }, initiative: { select: { title: true } }, tasks: { select: { status: true } } },
    }),
    operatorOptions(),
    staffOptions(),
    prisma.task.count({ where: { status: { in: [...OPEN] }, dueDate: { lt: now } } }),
  ]);

  return (
    <div>
      <PageHeader eyebrow="Delivery" title="Projects & tasks" description="Implementation projects and every action across the programme." actions={<ButtonLink href="/work/projects/new" variant="primary">New project</ButtonLink>} />
      <Card title="Active implementation projects" padded={false} className="mb-6">
        {projects.length === 0 ? <div className="p-5"><EmptyState title="No active projects" /></div> : (
          <Table>
            <thead><tr><th>Project</th><th>For</th><th>Status</th><th>Due</th><th className="w-40">Tasks</th></tr></thead>
            <tbody>
              {projects.map((p) => {
                const done = p.tasks.filter((t) => t.status === "DONE").length;
                return (
                  <tr key={p.id}>
                    <td><Link href={`/work/projects/${p.id}`} className="font-medium hover:underline">{p.title}</Link></td>
                    <td className="text-muted">{p.operator?.name ?? p.initiative?.title ?? "Programme"}</td>
                    <td><WorkStatusBadge s={p.status} /></td>
                    <td className="text-muted">{formatDate(p.dueDate)}</td>
                    <td><Progress value={done} max={p.tasks.length} label={`${done} of ${p.tasks.length} tasks done`} /><p className="mt-1 text-xs text-subtle">{done}/{p.tasks.length}</p></td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
      <Tabs
        current={`/work?view=${view}`}
        tabs={[
          { href: "/work?view=open", label: "Open" },
          { href: "/work?view=overdue", label: "Overdue", count: overdue },
          { href: "/work?view=blocked", label: "Blocked" },
          { href: "/work?view=mine", label: "Assigned to me" },
          { href: "/work?view=done", label: "Done" },
        ]}
      />
      <Card>
        <TaskList tasks={tasks} />
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-accent">Add a task</summary>
          <div className="mt-3"><TaskQuickAdd operatorOpts={operatorOpts} staffOpts={staffOpts} /></div>
        </details>
      </Card>
    </div>
  );
}
