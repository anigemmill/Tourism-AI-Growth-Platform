import { BriefView } from "@/components/BriefView";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { requireOperatorFeature } from "@/lib/auth/portal";
import { portalBriefs } from "@/lib/dal/portal";
import { formatDate } from "@/lib/format";

export default async function ReportsPage() {
  const { user } = await requireOperatorFeature("portal.dashboard");
  const briefs = await portalBriefs({ id: user.id, role: user.role, operatorId: user.operatorId }, 52);
  const [latest, ...past] = briefs;
  return (
    <div>
      <PageHeader
        eyebrow="Reviewed by the programme team"
        title="Reports"
        description="Your weekly growth briefs: what changed, why it matters and what to do next. Only briefs the programme team has reviewed and shared appear here."
      />
      {!latest ? (
        <EmptyState title="No reports shared yet">Your first weekly brief appears here once the programme team has reviewed it.</EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2" title={`Latest · week of ${formatDate(latest.weekOf)}`}>
            <BriefView brief={latest} />
          </Card>
          <Card title="Past reports" padded={false}>
            {past.length === 0 ? (
              <p className="p-5 text-sm text-muted">Earlier briefs will be listed here.</p>
            ) : (
              <ul className="divide-y divide-line">
                {past.map((b) => (
                  <li key={b.id} className="px-5 py-3">
                    <details>
                      <summary className="cursor-pointer text-sm font-medium text-ink">Week of {formatDate(b.weekOf)}</summary>
                      <div className="mt-3"><BriefView brief={b} /></div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
