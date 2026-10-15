import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getCurrentDestination } from "@/lib/destination";
import { Card, SectionHeading, EmptyState } from "@/components/ui";

export default async function OpportunitiesPage() {
  await requirePermission("destination.view");
  const destination = await getCurrentDestination();
  const [marketOpportunities, productGaps, partnerships, campaigns] = destination
    ? await Promise.all([
        prisma.marketOpportunity.findMany({ where: { destinationId: destination.id } }),
        prisma.productGap.findMany({ where: { destinationId: destination.id } }),
        prisma.partnership.findMany({ where: { destinationId: destination.id } }),
        prisma.campaign.findMany({ where: { destinationId: destination.id } }),
      ])
    : [[], [], [], []];

  return (
    <div className="space-y-8">
      <SectionHeading
        title="Opportunities & Campaigns"
        description="Market opportunities, product gaps, partnership ideas and campaigns — always tied back to the evidence that produced them, with what's still missing stated explicitly."
      />

      <section>
        <h2 className="font-medium mb-3">Market opportunities</h2>
        {marketOpportunities.length === 0 ? (
          <EmptyState
            title="None generated yet"
            needs={[
              "Visitor, demand and competitor data to reason over",
              "The Market Opportunity engine's logic (roadmap — docs/ARCHITECTURE.md §12; building it against zero real rows would mean shipping invented claims)",
            ]}
          />
        ) : (
          <Card>
            <ul className="text-sm space-y-3">
              {marketOpportunities.map((m) => (
                <li key={m.id}>
                  <p className="font-medium">{m.market} — {m.travellerType}</p>
                  <p className="text-black/60 dark:text-white/60">{m.gap}</p>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section>
        <h2 className="font-medium mb-3">Product gaps</h2>
        {productGaps.length === 0 ? (
          <EmptyState
            title="None generated yet"
            needs={["Experience supply data cross-referenced against demand signals — see Product Gap Engine, docs/ARCHITECTURE.md §12"]}
          />
        ) : (
          <Card>
            <ul className="text-sm space-y-3">
              {productGaps.map((p) => (
                <li key={p.id}>
                  <p className="font-medium">{p.targetVisitor}</p>
                  <p className="text-black/60 dark:text-white/60">{p.gap}</p>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section>
        <h2 className="font-medium mb-3">Partnerships</h2>
        {partnerships.length === 0 ? (
          <EmptyState title="None generated yet" needs={["Business ecosystem contributions — docs/ARCHITECTURE.md §12"]} />
        ) : (
          <Card>
            <ul className="text-sm space-y-3">
              {partnerships.map((p) => (
                <li key={p.id}>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-black/60 dark:text-white/60">{p.rationale}</p>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section>
        <h2 className="font-medium mb-3">Campaigns</h2>
        {campaigns.length === 0 ? (
          <EmptyState title="None drafted yet" needs={["The Action Layer / Campaign Engine — docs/ARCHITECTURE.md §12"]} />
        ) : (
          <Card>
            <ul className="text-sm space-y-3">
              {campaigns.map((c) => (
                <li key={c.id}>
                  <p className="font-medium">{c.objective}</p>
                  <p className="text-black/60 dark:text-white/60">
                    {c.audience} · {c.status}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
