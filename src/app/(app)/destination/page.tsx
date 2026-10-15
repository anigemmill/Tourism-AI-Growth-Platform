import { requirePermission } from "@/lib/auth/session";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentDestination } from "@/lib/destination";
import { Card, SectionHeading, StatTile, EmptyState } from "@/components/ui";

export default async function ExecutiveOverviewPage() {
  await requirePermission("destination.view");
  const destination = await getCurrentDestination();

  if (!destination) {
    return (
      <div>
        <SectionHeading
          title="Executive Overview"
          description="What is happening in Rotorua's visitor economy, and what should we do about it?"
        />
        <EmptyState
          title="Destination not seeded"
          needs={["Run `npm run db:seed` to register the Rotorua destination and reference data."]}
        />
      </div>
    );
  }

  const [
    sourcesConnected,
    sourcesTotal,
    importBatchCount,
    latestAICheck,
    weatherForecastCount,
    holidayCount,
    marketOpportunities,
    productGaps,
    scenarioQueryCount,
  ] = await Promise.all([
    prisma.dataSource.count({ where: { destinationId: destination.id, connectorStatus: "CONNECTED" } }),
    prisma.dataSource.count({ where: { destinationId: destination.id } }),
    prisma.importBatch.count({ where: { destinationId: destination.id } }),
    prisma.aIVisibilityCheck.findFirst({
      where: { destinationId: destination.id },
      orderBy: { runAt: "desc" },
    }),
    prisma.weatherForecast.count({ where: { destinationId: destination.id } }),
    prisma.publicHoliday.count({ where: { destinationId: destination.id } }),
    prisma.marketOpportunity.findMany({ where: { destinationId: destination.id }, take: 5 }),
    prisma.productGap.findMany({ where: { destinationId: destination.id }, take: 5 }),
    prisma.scenarioQuery.count({ where: { destinationId: destination.id } }),
  ]);

  const actions = [...marketOpportunities.map((m) => `Market opportunity: ${m.market} — ${m.gap}`), ...productGaps.map((p) => `Product gap: ${p.gap}`)];

  return (
    <div>
      <SectionHeading
        title="Executive Overview"
        description="What is happening in Rotorua's visitor economy, and what should we do about it?"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatTile label="Data sources registered" value={sourcesTotal} sub={`${sourcesConnected} connected live`} />
        <StatTile label="Manual import batches" value={importBatchCount} />
        <StatTile
          label="Weather forecast rows"
          value={weatherForecastCount}
          sub={weatherForecastCount === 0 ? "connector not yet run" : undefined}
        />
        <StatTile
          label="Public holidays tracked"
          value={holidayCount}
          sub={holidayCount === 0 ? "connector not yet run" : undefined}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <h2 className="font-medium mb-2">AI Discovery — last check</h2>
          {latestAICheck ? (
            <p className="text-sm">
              Last run {latestAICheck.runAt.toLocaleString()} against {latestAICheck.aiSystem}.{" "}
              <Link href="/destination/ai-visibility" className="underline">
                View results
              </Link>
            </p>
          ) : (
            <p className="text-sm text-black/60 dark:text-white/60">
              Never run. Visit{" "}
              <Link href="/destination/ai-visibility" className="underline">
                AI Discovery
              </Link>{" "}
              to test how AI systems currently describe Rotorua (requires ANTHROPIC_API_KEY).
            </p>
          )}
        </Card>

        <Card>
          <h2 className="font-medium mb-2">Scenario Engine</h2>
          <p className="text-sm text-black/60 dark:text-white/60">
            {scenarioQueryCount} question{scenarioQueryCount === 1 ? "" : "s"} asked so far.{" "}
            <Link href="/destination/scenario" className="underline">
              Ask a question
            </Link>
          </p>
        </Card>
      </div>

      <div className="mt-8">
        <h2 className="font-medium mb-3">What to do next</h2>
        {actions.length > 0 ? (
          <Card>
            <ul className="list-disc list-inside text-sm space-y-1">
              {actions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </Card>
        ) : (
          <EmptyState
            title="No recommendations generated yet"
            needs={[
              "Visitor, accommodation and demand data connected or imported (see Data Governance)",
              "The Market Opportunity and Product Gap engines run against that data (roadmap — see docs/ARCHITECTURE.md §12)",
            ]}
          />
        )}
      </div>
    </div>
  );
}
