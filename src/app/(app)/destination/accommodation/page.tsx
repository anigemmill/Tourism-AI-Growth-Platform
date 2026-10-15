import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getCurrentDestination } from "@/lib/destination";
import { Card, SectionHeading, EmptyState, Badge } from "@/components/ui";
import { ACCESS_LEVEL_LABELS, CONFIDENCE_LABELS } from "@/lib/governance";

export default async function AccommodationPage() {
  await requirePermission("destination.view");
  const destination = await getCurrentDestination();
  const metrics = destination
    ? await prisma.accommodationMetric.findMany({
        where: { destinationId: destination.id },
        include: { source: true, property: true },
        orderBy: { periodStart: "desc" },
        take: 100,
      })
    : [];

  return (
    <div>
      <SectionHeading
        title="Accommodation"
        description="Capacity, occupancy, room nights and forward bookings by property or type."
      />

      {metrics.length === 0 ? (
        <EmptyState
          title="No accommodation metrics yet"
          needs={[
            "Occupancy/room-nights exports from accommodation providers or MBIE's accommodation survey — import via Data Governance",
          ]}
        />
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead className="text-left text-black/50 dark:text-white/50">
              <tr>
                <th className="pb-2">Metric</th>
                <th className="pb-2">Value</th>
                <th className="pb-2">Property / Type</th>
                <th className="pb-2">Period</th>
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
                  <td className="py-2 pr-2">{m.property?.name ?? m.accommodationType ?? "—"}</td>
                  <td className="py-2 pr-2">
                    {m.periodStart.toLocaleDateString()} – {m.periodEnd.toLocaleDateString()}
                  </td>
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
