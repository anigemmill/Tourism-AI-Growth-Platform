import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getCurrentDestination } from "@/lib/destination";
import { Card, SectionHeading, EmptyState, Badge } from "@/components/ui";
import { ACCESS_LEVEL_LABELS, CONFIDENCE_LABELS } from "@/lib/governance";

export default async function VisitorsPage() {
  await requirePermission("destination.view");
  const destination = await getCurrentDestination();
  const metrics = destination
    ? await prisma.visitorMetric.findMany({
        where: { destinationId: destination.id },
        include: { source: true },
        orderBy: { periodStart: "desc" },
        take: 100,
      })
    : [];

  return (
    <div>
      <SectionHeading
        title="Visitor Demand, Spend & Length of Stay"
        description="Covers visitor volume, source markets, spend and length of stay — the brief's Visitor Demand, Visitor Spend, Length of Stay and Source Markets sections, grouped here since they share one metric table."
      />

      {metrics.length === 0 ? (
        <EmptyState
          title="No visitor metrics yet"
          needs={[
            "RotoruaNZ / MBIE / Stats NZ visitor volume, spend and length-of-stay data — import via Data Governance",
          ]}
        />
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead className="text-left text-black/50 dark:text-white/50">
              <tr>
                <th className="pb-2">Metric</th>
                <th className="pb-2">Value</th>
                <th className="pb-2">Market</th>
                <th className="pb-2">Period</th>
                <th className="pb-2">Geography</th>
                <th className="pb-2">Source</th>
                <th className="pb-2">Governance</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => (
                <tr key={m.id} className="border-t border-black/5 dark:border-white/10">
                  <td className="py-2 pr-2">{m.metric}</td>
                  <td className="py-2 pr-2">
                    {m.value} {m.unit}
                  </td>
                  <td className="py-2 pr-2">{m.originMarket ?? "All markets"}</td>
                  <td className="py-2 pr-2">
                    {m.periodStart.toLocaleDateString()} – {m.periodEnd.toLocaleDateString()}
                  </td>
                  <td className="py-2 pr-2">{m.geography}</td>
                  <td className="py-2 pr-2">{m.source.name}</td>
                  <td className="py-2 pr-2 space-x-1">
                    <Badge tone={m.accessLevel}>{ACCESS_LEVEL_LABELS[m.accessLevel]}</Badge>
                    <Badge>{CONFIDENCE_LABELS[m.confidence]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
