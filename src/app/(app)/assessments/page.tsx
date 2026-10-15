import Link from "next/link";
import { AssessmentStatusBadge, Badge, Card, PageHeader, Table, Stat } from "@/components/ui";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";

export default async function AssessmentsPage() {
  await requirePermission("assessments.view");
  const operators = await prisma.operator.findMany({
    where: { status: { notIn: ["WITHDRAWN"] } },
    orderBy: { name: "asc" },
    include: {
      assessments: { orderBy: { createdAt: "desc" }, take: 1, include: { areas: true, _count: { select: { opportunities: true } } } },
    },
  });

  const complete = operators.filter((o) => o.assessments[0]?.status === "COMPLETE").length;
  const inProgress = operators.filter((o) => o.assessments[0] && o.assessments[0].status !== "COMPLETE").length;

  return (
    <div>
      <PageHeader
        eyebrow="Operators"
        title="AI assessments"
        description="Nine areas per operator. Record what you observed separately from what the operator reported. Scores describe current capability (1 weak – 5 strong), not AI potential."
      />
      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="Complete" value={complete} tone="success" />
        <Stat label="In progress" value={inProgress} />
        <Stat label="Not started" value={operators.length - complete - inProgress} tone={operators.length - complete - inProgress ? "warning" : "default"} />
      </div>
      <Card padded={false}>
        <Table>
          <thead><tr><th>Operator</th><th>Status</th><th>Date</th><th className="text-right">Avg score</th><th>Weakest areas</th><th className="text-right">Opportunities</th><th>Shared</th></tr></thead>
          <tbody>
            {operators.map((o) => {
              const a = o.assessments[0];
              const scored = a?.areas.filter((x) => x.score != null) ?? [];
              const avg = scored.length ? scored.reduce((s, x) => s + (x.score ?? 0), 0) / scored.length : null;
              const weakest = [...scored].sort((x, y) => (x.score ?? 0) - (y.score ?? 0)).slice(0, 2);
              return (
                <tr key={o.id}>
                  <td><Link href={a ? `/assessments/${a.id}` : `/operators/${o.id}`} className="font-medium hover:underline">{o.name}</Link></td>
                  <td>{a ? <AssessmentStatusBadge s={a.status} /> : <Badge tone="outline">Not started</Badge>}</td>
                  <td className="text-muted">{formatDate(a?.conductedAt)}</td>
                  <td className="text-right tabular-nums">{avg ? avg.toFixed(1) : "—"}</td>
                  <td className="text-xs text-muted">{weakest.map((w) => w.area.replaceAll("_", " ").toLowerCase()).join(", ") || "—"}</td>
                  <td className="text-right tabular-nums">{a?._count.opportunities ?? 0}</td>
                  <td>{a?.sharedWithOperator ? <Badge tone="success">Yes</Badge> : <Badge tone="outline">No</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
