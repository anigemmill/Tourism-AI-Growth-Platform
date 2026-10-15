import { Card, PageHeader, Table } from "@/components/ui";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export default async function AuditPage({ searchParams }: PageProps<"/governance/audit">) {
  await requirePermission("audit.view");
  const type = (await searchParams).type;
  const rows = await prisma.auditLog.findMany({
    where: typeof type === "string" ? { entityType: type } : {},
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { actor: { select: { name: true } } },
  });
  const fmt = new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium", timeStyle: "short", timeZone: "Pacific/Auckland" });
  return (
    <div>
      <PageHeader eyebrow="Governance" title="Audit log" description="Latest 300 events. Includes logins, changes, threshold changes on running experiments, visibility changes and exports." />
      <Card padded={false}>
        <Table>
          <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Record</th><th>Summary</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap text-xs text-muted">{fmt.format(r.createdAt)}</td>
                <td className="text-sm">{r.actor?.name ?? "system"}</td>
                <td className={`text-xs ${r.action === "threshold_change" ? "font-semibold text-warning" : "text-muted"}`}>{r.action}</td>
                <td className="text-xs text-muted">{r.entityType}</td>
                <td className="text-sm">{r.summary}{r.changes && Object.keys(r.changes as object).length > 0 && <details><summary className="cursor-pointer text-xs text-accent">changes</summary><pre className="mt-1 max-w-xl overflow-x-auto whitespace-pre-wrap text-[11px] text-muted">{JSON.stringify(r.changes, null, 1)}</pre></details>}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
