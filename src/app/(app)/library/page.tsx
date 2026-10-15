import Link from "next/link";
import { ButtonLink, Card, EmptyState, Notice, PageHeader, Table, WorkflowKindBadge, WorkflowStatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export default async function LibraryPage() {
  await requirePermission("library.view");
  const rows = await prisma.workflowAsset.findMany({ orderBy: [{ status: "desc" }, { name: "asc" }], include: { _count: { select: { usages: true, versions: true } } } });
  return (
    <div>
      <PageHeader eyebrow="Intelligence" title="Agent & workflow library" description="Reusable prompts, workflows and agents. Status claims are gated: nothing is 'validated' or 'operational' without recorded test results." actions={<ButtonLink href="/library/new" variant="primary">Add</ButtonLink>} />
      <div className="mb-6"><Notice tone="info">No AI agent in this library acts autonomously. Every output that affects a customer, spends money or publishes content needs human approval.</Notice></div>
      {rows.length === 0 ? <EmptyState title="Library is empty" /> : (
        <Card padded={false}>
          <Table>
            <thead><tr><th>Name</th><th>What it is</th><th>Status</th><th>Initiative</th><th className="text-right">Version</th><th className="text-right">Operators</th></tr></thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td className="min-w-[16rem]"><Link href={`/library/${a.id}`} className="font-medium hover:underline">{a.name}</Link><p className="line-clamp-2 text-xs text-muted">{a.purpose}</p></td>
                  <td><WorkflowKindBadge k={a.kind} /></td>
                  <td><WorkflowStatusBadge s={a.status} /></td>
                  <td className="text-xs text-muted">{a.strategicInitiative ?? "—"}</td>
                  <td className="text-right tabular-nums">v{a.currentVersion}</td>
                  <td className="text-right tabular-nums">{a._count.usages}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
