import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getCurrentDestination } from "@/lib/destination";
import { getSession } from "@/lib/session";
import { Card, SectionHeading, EmptyState, Badge } from "@/components/ui";
import { AIDiscoveryRunButton } from "@/components/AIDiscoveryRunButton";

export default async function AIVisibilityPage() {
  await requirePermission("destination.view");
  const session = await getSession();
  const canManage = session.canManage;
  const destination = await getCurrentDestination();
  const [prompts, checks] = destination
    ? await Promise.all([
        prisma.trackedPrompt.findMany({ where: { destinationId: destination.id, active: true } }),
        prisma.aIVisibilityCheck.findMany({
          where: { destinationId: destination.id },
          orderBy: { runAt: "desc" },
          take: 30,
          include: { prompt: true },
        }),
      ])
    : [[], []];

  return (
    <div className="space-y-6">
      <SectionHeading
        title="AI Discovery Engine"
        description="Continuously tests how AI systems represent Rotorua — whether it's mentioned, what's recommended, and against which competitors — against a tracked bank of real traveller questions."
      />

      <Card>
        <p className="text-sm text-black/60 dark:text-white/60 mb-3">
          {prompts.length} tracked prompt(s) configured in <code>src/config/destinations/rotorua.ts</code>. Running
          requires <code>ANTHROPIC_API_KEY</code> to be configured — without it this reports that nothing was run,
          rather than fabricating results.
        </p>
        {canManage ? (
          <AIDiscoveryRunButton />
        ) : (
          <p className="text-xs text-black/50 dark:text-white/50">
            Requires the “Import data &amp; run connectors” permission.
          </p>
        )}
      </Card>

      {checks.length === 0 ? (
        <EmptyState
          title="No AI Discovery checks run yet"
          needs={["ANTHROPIC_API_KEY configured, then click “Run AI Discovery now” above"]}
        />
      ) : (
        <div className="space-y-4">
          {checks.map((c) => (
            <Card key={c.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-sm">{c.prompt.prompt}</p>
                  <p className="text-xs text-black/50 dark:text-white/50">
                    {c.aiSystem} · {c.runAt.toLocaleString()}
                  </p>
                </div>
                <Badge tone={c.destinationMentioned ? "PUBLIC" : "PRIVATE_BUSINESS"}>
                  {c.destinationMentioned ? "Rotorua mentioned" : "Not mentioned"}
                </Badge>
              </div>
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-black/60 dark:text-white/60">View raw response</summary>
                <p className="mt-2 whitespace-pre-wrap text-black/80 dark:text-white/80">{c.rawResponse}</p>
              </details>
              <p className="mt-2 text-xs text-black/50 dark:text-white/50">
                Mention position, named experiences/competitors and factual issues await a human review pass — see{" "}
                <code>PATCH /api/ai-discovery/[id]/review</code>.
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
