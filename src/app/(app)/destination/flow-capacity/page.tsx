import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getCurrentDestination } from "@/lib/destination";
import { Card, SectionHeading, EmptyState } from "@/components/ui";

export default async function FlowCapacityPage() {
  await requirePermission("destination.view");
  const destination = await getCurrentDestination();
  const [capacityRecords, experiences] = destination
    ? await Promise.all([
        prisma.capacityRecord.findMany({ where: { destinationId: destination.id }, take: 100 }),
        prisma.experience.count({ where: { destinationId: destination.id } }),
      ])
    : [[], 0];

  return (
    <div>
      <SectionHeading
        title="Visitor Flow & Capacity"
        description="Where visitors concentrate, where capacity exists or is under pressure, and mismatches between demand and available capacity."
      />

      {capacityRecords.length === 0 ? (
        <EmptyState
          title="No capacity or flow data yet"
          needs={[
            "Attraction/accommodation/transport capacity data — import via Data Governance",
            "Geographic and time-of-day visitor movement data (mobile location panels, ticketing systems, etc.) — not available to this build; needed before the Visitor Flow and Demand/Capacity Matching engines can produce real output (docs/ARCHITECTURE.md §12)",
          ]}
        />
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead className="text-left text-black/50 dark:text-white/50">
              <tr>
                <th className="pb-2">Type</th>
                <th className="pb-2">Total capacity</th>
                <th className="pb-2">Available</th>
                <th className="pb-2">Verified?</th>
              </tr>
            </thead>
            <tbody>
              {capacityRecords.map((c) => (
                <tr key={c.id} className="border-t border-black/5 dark:border-white/10">
                  <td className="py-2 pr-2">{c.capacityType}</td>
                  <td className="py-2 pr-2">
                    {c.totalCapacity ?? "—"} {c.unit}
                  </td>
                  <td className="py-2 pr-2">{c.availableCapacity ?? "—"}</td>
                  <td className="py-2 pr-2">{c.verifiedAvailable ? "Yes" : "No — not bookable-ready"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <p className="mt-4 text-sm text-black/50 dark:text-white/50">
        {experiences} experience(s) registered in the reference taxonomy (see Data Governance for import).
      </p>
    </div>
  );
}
