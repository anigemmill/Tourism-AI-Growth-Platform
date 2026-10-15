import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getCurrentDestination } from "@/lib/destination";
import { Card, SectionHeading, EmptyState, Badge } from "@/components/ui";
import { ACCESS_LEVEL_LABELS, CONFIDENCE_LABELS } from "@/lib/governance";

export default async function DemandPage() {
  await requirePermission("destination.view");
  const destination = await getCurrentDestination();
  const signals = destination
    ? await prisma.demandSignal.findMany({
        where: { destinationId: destination.id },
        include: { source: true },
        orderBy: { periodStart: "desc" },
        take: 100,
      })
    : [];

  return (
    <div>
      <SectionHeading
        title="Search & AI Demand Signals"
        description="Search trend, AI travel query and social-conversation demand — what people are interested in, before they book."
      />

      {signals.length === 0 ? (
        <EmptyState
          title="No demand signals yet"
          needs={[
            "Search trend data (e.g. Google Trends export) — import via Data Governance",
            "Social/AI-query listening — roadmap connector (docs/ARCHITECTURE.md §12)",
          ]}
        />
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead className="text-left text-black/50 dark:text-white/50">
              <tr>
                <th className="pb-2">Signal type</th>
                <th className="pb-2">Topic</th>
                <th className="pb-2">Value</th>
                <th className="pb-2">Geography</th>
                <th className="pb-2">Period</th>
                <th className="pb-2">Source</th>
                <th className="pb-2">Governance</th>
              </tr>
            </thead>
            <tbody>
              {signals.map((s) => (
                <tr key={s.id} className="border-t border-black/5 dark:border-white/10">
                  <td className="py-2 pr-2">{s.signalType}</td>
                  <td className="py-2 pr-2">{s.topic}</td>
                  <td className="py-2 pr-2">
                    {s.value} {s.unit}
                  </td>
                  <td className="py-2 pr-2">{s.geography}</td>
                  <td className="py-2 pr-2">
                    {s.periodStart.toLocaleDateString()} – {s.periodEnd.toLocaleDateString()}
                  </td>
                  <td className="py-2 pr-2">{s.source.name}</td>
                  <td className="py-2 pr-2 space-x-1">
                    <Badge tone={s.accessLevel}>{ACCESS_LEVEL_LABELS[s.accessLevel]}</Badge>
                    <Badge>{CONFIDENCE_LABELS[s.confidence]}</Badge>
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
