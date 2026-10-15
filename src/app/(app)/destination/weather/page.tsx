import { requirePermission } from "@/lib/auth/session";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentDestination } from "@/lib/destination";
import { Card, SectionHeading, EmptyState } from "@/components/ui";

export default async function WeatherPage() {
  await requirePermission("destination.view");
  const destination = await getCurrentDestination();
  const [observations, forecasts] = destination
    ? await Promise.all([
        prisma.weatherObservation.findMany({
          where: { destinationId: destination.id },
          orderBy: { observedAt: "desc" },
          take: 1,
        }),
        prisma.weatherForecast.findMany({
          where: { destinationId: destination.id },
          orderBy: { forDate: "asc" },
          take: 7,
        }),
      ])
    : [[], []];

  return (
    <div>
      <SectionHeading
        title="Weather Intelligence"
        description="Current conditions and forecast, as a destination-level demand signal — what it means for outdoor vs. indoor/cultural/wellness experiences over the next 24–48 hours and this weekend."
      />

      {observations.length === 0 && forecasts.length === 0 ? (
        <EmptyState
          title="No weather data yet"
          needs={[
            "The Open-Meteo connector run from Data Governance (or a deployment where api.open-meteo.com is reachable — see docs/CONNECTOR_STATUS.md)",
          ]}
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {observations[0] && (
            <Card>
              <h2 className="font-medium mb-2">Current conditions</h2>
              <p className="text-2xl font-semibold">{observations[0].temperatureC}°C</p>
              <p className="text-sm text-black/60 dark:text-white/60">
                Condition code {observations[0].conditionCode} · observed {observations[0].observedAt.toLocaleString()}
              </p>
            </Card>
          )}
          {forecasts.length > 0 && (
            <Card>
              <h2 className="font-medium mb-2">7-day forecast</h2>
              <ul className="text-sm space-y-1">
                {forecasts.map((f) => (
                  <li key={f.id} className="flex justify-between">
                    <span>{f.forDate.toLocaleDateString()}</span>
                    <span>
                      {f.temperatureMinC}° – {f.temperatureMaxC}°C
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      <p className="mt-6 text-sm text-black/50 dark:text-white/50">
        Run or re-run the weather connector from{" "}
        <Link href="/destination/data-governance" className="underline">
          Data Governance
        </Link>
        .
      </p>
    </div>
  );
}
