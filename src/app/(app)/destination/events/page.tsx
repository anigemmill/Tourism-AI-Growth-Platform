import { requirePermission } from "@/lib/auth/session";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentDestination } from "@/lib/destination";
import { Card, SectionHeading, EmptyState } from "@/components/ui";

export default async function EventsPage() {
  await requirePermission("destination.view");
  const destination = await getCurrentDestination();
  const [holidays, events] = destination
    ? await Promise.all([
        prisma.publicHoliday.findMany({
          where: { destinationId: destination.id, date: { gte: new Date() } },
          orderBy: { date: "asc" },
          take: 20,
        }),
        prisma.destinationEvent.findMany({
          where: { destinationId: destination.id },
          orderBy: { startsAt: "asc" },
          take: 20,
        }),
      ])
    : [[], []];

  return (
    <div>
      <SectionHeading
        title="Events"
        description="Public holidays, festivals, sport, conferences and other events that affect accommodation demand, visitor flow and length of stay."
      />

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <h2 className="font-medium mb-2">Upcoming public holidays</h2>
          {holidays.length === 0 ? (
            <EmptyState
              title="No public holidays loaded"
              needs={["The Nager.Date connector run from Data Governance — see docs/CONNECTOR_STATUS.md"]}
            />
          ) : (
            <ul className="text-sm space-y-1">
              {holidays.map((h) => (
                <li key={h.id} className="flex justify-between">
                  <span>{h.name}</span>
                  <span>{h.date.toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="font-medium mb-2">Destination events</h2>
          {events.length === 0 ? (
            <EmptyState
              title="No events loaded"
              needs={["Event calendars not published via a public API — import via Data Governance"]}
            />
          ) : (
            <ul className="text-sm space-y-1">
              {events.map((e) => (
                <li key={e.id} className="flex justify-between">
                  <span>{e.name}</span>
                  <span>{e.startsAt.toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <p className="mt-6 text-sm text-black/50 dark:text-white/50">
        Run or re-run the holidays connector from{" "}
        <Link href="/destination/data-governance" className="underline">
          Data Governance
        </Link>
        .
      </p>
    </div>
  );
}
