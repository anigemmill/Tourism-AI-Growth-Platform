import Link from "next/link";
import type { Prisma } from "@/generated/prisma";
import { Badge, ButtonLink, Card, DecisionBadge, EmptyState, EvidenceBadge, HorizonBadge, OppStatusBadge, PageHeader, Table, Tabs } from "@/components/ui";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { priorityScore } from "@/lib/domain/prioritise";
import { SOLUTION_LABELS } from "@/lib/labels";
import { formatNzd } from "@/lib/format";

const HORIZONS = ["NOW", "NEXT", "LATER", "IGNORE"] as const;

export default async function OpportunitiesPage({ searchParams }: PageProps<"/opportunities">) {
  await requirePermission("opportunities.view");
  const sp = await searchParams;
  const horizon = HORIZONS.find((h) => h === sp.horizon);
  const operator = typeof sp.operator === "string" ? sp.operator : undefined;
  const where: Prisma.OpportunityWhereInput = {
    ...(horizon ? { horizon } : {}),
    ...(operator ? { operatorId: operator } : {}),
  };
  const [rows, counts, opName] = await Promise.all([
    prisma.opportunity.findMany({
      where,
      include: { operator: { select: { id: true, name: true } }, initiative: { select: { id: true, title: true } }, owner: { select: { name: true } }, template: { select: { name: true } } },
    }),
    prisma.opportunity.groupBy({ by: ["horizon"], _count: true, where: operator ? { operatorId: operator } : {} }),
    operator ? prisma.operator.findUnique({ where: { id: operator }, select: { name: true } }) : null,
  ]);
  rows.sort((a, b) => HORIZONS.indexOf(a.horizon) - HORIZONS.indexOf(b.horizon) || priorityScore(b) - priorityScore(a));
  const count = (h: string) => counts.find((c) => c.horizon === h)?._count ?? 0;
  const base = operator ? `/opportunities?operator=${operator}` : "/opportunities";
  const join = (q: string) => (operator ? `${base}&${q}` : `${base}?${q}`);

  return (
    <div>
      <PageHeader
        eyebrow="Opportunities"
        title={opName ? `Opportunity register — ${opName.name}` : "Opportunity & implementation register"}
        description="Every opportunity across the cohort and shared initiatives. Convert to projects, tasks or experiments from the detail view; record a scale / amend / stop decision once results are in."
        actions={
          <>
            <ButtonLink href="/opportunities/templates">Solution templates</ButtonLink>
            <ButtonLink href={`/opportunities/new${operator ? `?operatorId=${operator}` : ""}`} variant="primary">Record opportunity</ButtonLink>
          </>
        }
      />
      <Tabs
        current={horizon ? join(`horizon=${horizon}`) : base}
        tabs={[{ href: base, label: "All", count: counts.reduce((s, c) => s + c._count, 0) }, ...HORIZONS.map((h) => ({ href: join(`horizon=${h}`), label: h[0] + h.slice(1).toLowerCase(), count: count(h) }))]}
      />
      {rows.length === 0 ? (
        <EmptyState title="No opportunities match" />
      ) : (
        <Card padded={false}>
          <Table>
            <thead>
              <tr><th>Opportunity</th><th>Operator / initiative</th><th>Type</th><th>Horizon</th><th className="text-right">Score</th><th>Basis</th><th className="text-right">Cost</th><th>Status</th><th>Decision</th></tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id}>
                  <td className="min-w-[16rem]">
                    <Link href={`/opportunities/${o.id}`} className="font-medium hover:underline">{o.title}</Link>
                    <p className="line-clamp-2 text-xs text-muted">{o.problem}</p>
                    {o.template && <p className="mt-0.5 text-xs text-subtle">Template: {o.template.name}</p>}
                  </td>
                  <td className="text-muted">
                    {o.operator ? <Link href={`/operators/${o.operator.id}`} className="hover:underline">{o.operator.name}</Link> : o.initiative ? <Badge tone="accent">{o.initiative.title}</Badge> : "—"}
                  </td>
                  <td className="text-xs text-muted">{SOLUTION_LABELS[o.solutionType]}</td>
                  <td><HorizonBadge h={o.horizon} /></td>
                  <td className="text-right tabular-nums">{priorityScore(o)}</td>
                  <td><EvidenceBadge k={o.evidenceBasis} /></td>
                  <td className="whitespace-nowrap text-right text-xs tabular-nums text-muted">
                    {o.oneOffCostNzd != null ? formatNzd(o.oneOffCostNzd) : "—"}
                    {o.monthlyCostNzd ? ` + ${formatNzd(o.monthlyCostNzd)}/mo` : ""}
                  </td>
                  <td><OppStatusBadge s={o.status} /></td>
                  <td><DecisionBadge d={o.decision} /></td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
