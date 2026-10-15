import Link from "next/link";
import { Badge, ButtonLink, Card, EmptyState, OperatorStatusBadge, PageHeader, SyntheticBadge, Table, Tabs, AssessmentStatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { OPERATOR_STATUS_LABELS } from "@/lib/labels";

type Group = "none" | "category" | "status" | "tag";

export default async function OperatorsPage({ searchParams }: PageProps<"/operators">) {
  await requirePermission("operators.view");
  const sp = await searchParams;
  const group = (["category", "status", "tag"].includes(String(sp.group)) ? sp.group : "none") as Group;

  const operators = await prisma.operator.findMany({
    orderBy: { name: "asc" },
    include: {
      assessments: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } },
      _count: { select: { opportunities: true, tasks: { where: { status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] } } } } },
      initiatives: { select: { initiative: { select: { title: true } } } },
    },
  });

  const groups = new Map<string, typeof operators>();
  for (const o of operators) {
    const keys =
      group === "category" ? [o.category] : group === "status" ? [OPERATOR_STATUS_LABELS[o.status]] : group === "tag" ? (o.groupTags.length ? o.groupTags : ["(untagged)"]) : ["All operators"];
    for (const k of keys) groups.set(k, [...(groups.get(k) ?? []), o]);
  }

  const synthetic = operators.filter((o) => o.isSynthetic).length;

  return (
    <div>
      <PageHeader
        eyebrow="Operators"
        title="Cohort & operators"
        description={`${operators.length} operators${synthetic ? ` · ${synthetic} are synthetic demo records` : ""}. Group by business type, programme stage or collaboration tags.`}
        actions={<ButtonLink href="/operators/new" variant="primary">Add operator</ButtonLink>}
      />
      <Tabs
        current={`/operators${group === "none" ? "" : `?group=${group}`}`}
        tabs={[
          { href: "/operators", label: "All" },
          { href: "/operators?group=category", label: "By business type" },
          { href: "/operators?group=status", label: "By programme stage" },
          { href: "/operators?group=tag", label: "By need / collaboration tag" },
        ]}
      />
      {operators.length === 0 ? (
        <EmptyState title="No operators yet" action={<ButtonLink href="/operators/new" variant="primary">Add the first operator</ButtonLink>}>
          Add each participating business to start onboarding, assessments and roadmaps.
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {[...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, list]) => (
            <Card key={label} title={group === "none" ? undefined : label} description={group === "none" ? undefined : `${list.length} operator${list.length === 1 ? "" : "s"}`} padded={false}>
              <Table>
                <thead>
                  <tr>
                    <th>Operator</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>AI maturity</th>
                    <th>Assessment</th>
                    <th className="text-right">Opportunities</th>
                    <th className="text-right">Open tasks</th>
                    <th>Consents</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link href={`/operators/${o.id}`} className="font-medium text-ink hover:underline">{o.name}</Link>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {o.isSynthetic && <SyntheticBadge />}
                          {o.initiatives.map((i) => <Badge key={i.initiative.title} tone="accent">{i.initiative.title}</Badge>)}
                        </div>
                      </td>
                      <td className="text-muted">{o.category}</td>
                      <td><OperatorStatusBadge s={o.status} /></td>
                      <td className="tabular-nums text-muted">{o.aiMaturity ? `${o.aiMaturity}/5` : "—"}</td>
                      <td>{o.assessments[0] ? <AssessmentStatusBadge s={o.assessments[0].status} /> : <Badge tone="outline">None</Badge>}</td>
                      <td className="text-right tabular-nums">{o._count.opportunities}</td>
                      <td className="text-right tabular-nums">{o._count.tasks}</td>
                      <td className="whitespace-nowrap text-xs text-muted">
                        <span title="Data agreement signed">{o.dataAgreementSignedAt ? "Agreement ✓" : "No agreement"}</span>
                        {" · "}
                        <span title="Cohort / aggregate / case study">
                          {[o.consentCohortSharing && "C", o.consentAggregate && "A", o.consentCaseStudy && "P"].filter(Boolean).join("") || "none"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          ))}
          <p className="text-xs text-subtle">Consents: C = cohort sharing · A = anonymised aggregate · P = public case study.</p>
        </div>
      )}
    </div>
  );
}
