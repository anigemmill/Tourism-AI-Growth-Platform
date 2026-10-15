import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getCurrentDestination } from "@/lib/destination";
import { getSession } from "@/lib/session";
import { Card, SectionHeading, EmptyState } from "@/components/ui";
import { ScenarioForm } from "@/components/ScenarioForm";

export default async function ScenarioPage() {
  await requirePermission("destination.view");
  const session = await getSession();
  const destination = await getCurrentDestination();
  const history = destination
    ? await prisma.scenarioQuery.findMany({
        where: { destinationId: destination.id },
        orderBy: { createdAt: "desc" },
        take: 10,
      })
    : [];

  if (session.role === "PUBLIC") {
    return (
      <div>
        <SectionHeading title="Scenario Engine" />
        <EmptyState
          title="Requires a PARTNER, BUSINESS or ADMIN session"
          needs={["Switch your dev session role in the sidebar to try this."]}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SectionHeading
        title="Scenario Engine"
        description="Ask a strategic question. Every answer is grounded in what's actually in the database and labelled FACT / EVIDENCE / INFERENCE / HYPOTHESIS / RECOMMENDATION — never an invented statistic."
      />

      <Card>
        <ScenarioForm />
      </Card>

      <section>
        <h2 className="font-medium mb-3">Recent questions</h2>
        {history.length === 0 ? (
          <EmptyState title="No questions asked yet" needs={["Ask one above"]} />
        ) : (
          <div className="space-y-2">
            {history.map((q) => (
              <Card key={q.id}>
                <p className="text-sm font-medium">{q.question}</p>
                <p className="text-xs text-black/50 dark:text-white/50">
                  {q.askedBy} · {q.createdAt.toLocaleString()} · {q.llmAssisted ? "LLM-assisted" : "mechanical"}
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
