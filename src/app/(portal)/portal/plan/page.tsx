import Link from "next/link";
import { Card, EmptyState, PageHeader, Progress, Table, WorkStatusBadge, cx } from "@/components/ui";
import { MoveCard, isDone } from "@/components/portal/MoveCard";
import { requireOperatorFeature } from "@/lib/auth/portal";
import { portalOpportunities, portalTasks } from "@/lib/dal/portal";
import { roadmapOrder } from "@/lib/domain/prioritise";
import { formatShortDate } from "@/lib/format";
import { HORIZON_LABELS } from "@/lib/labels";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "todo", label: "To do" },
  { key: "high", label: "High impact" },
  { key: "done", label: "Done" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

export default async function PlanPage({ searchParams }: PageProps<"/portal/plan">) {
  const { user } = await requireOperatorFeature("portal.dashboard");
  const actor = { id: user.id, role: user.role, operatorId: user.operatorId };
  const sp = await searchParams;
  const filter: FilterKey = FILTERS.some((f) => f.key === sp.show) ? (sp.show as FilterKey) : "all";
  const [opps, tasks] = await Promise.all([portalOpportunities(actor), portalTasks(actor)]);

  const plan = roadmapOrder(opps.filter((o) => o.horizon !== "IGNORE" && o.status !== "REJECTED"));
  const done = plan.filter((o) => isDone(o.status)).length;
  const shown = plan.filter((o) =>
    filter === "todo" ? !isDone(o.status) : filter === "done" ? isDone(o.status) : filter === "high" ? o.impactScore >= 4 : true
  );
  const byHorizon = (["NOW", "NEXT", "LATER"] as const).map((h) => ({ h, items: shown.filter((o) => o.horizon === h) })).filter((g) => g.items.length);
  const openTasks = tasks.filter((t) => !["DONE", "CANCELLED"].includes(t.status));

  return (
    <div>
      <PageHeader
        eyebrow="Ranked by impact and effort"
        title="Your action plan"
        description="The changes most likely to grow your business, agreed with the programme team. Ask the team if you'd like help with any of them."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="eyebrow text-muted">Progress</p>
          <p className="stat-value mt-2">{done}<span className="ml-1.5 text-base font-medium tracking-normal text-muted">of {plan.length} done</span></p>
          <div className="mt-3"><Progress value={done} max={plan.length} label="Plan progress" /></div>
        </Card>
        <Card>
          <p className="eyebrow text-muted">Open actions</p>
          <p className="stat-value mt-2">{openTasks.length}</p>
          <p className="mt-2 text-xs text-subtle">Tasks assigned to your business by the programme team.</p>
        </Card>
      </div>

      <nav aria-label="Filter plan" className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/portal/plan" : `/portal/plan?show=${f.key}`}
            aria-current={filter === f.key ? "page" : undefined}
            className={cx("rounded-full px-3.5 py-1.5 text-sm", filter === f.key ? "bg-night font-medium text-night-ink" : "text-muted hover:bg-surface hover:text-ink")}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      <div className="space-y-6">
        {plan.length === 0 ? (
          <EmptyState title="Your plan is being prepared">The programme team builds your plan from your assessment. It will appear here.</EmptyState>
        ) : byHorizon.length === 0 ? (
          <EmptyState title="Nothing matches this filter" />
        ) : (
          byHorizon.map((g) => (
            <section key={g.h}>
              <h2 className="eyebrow mb-2 text-muted">{HORIZON_LABELS[g.h]}</h2>
              <div className="space-y-3">{g.items.map((m) => <MoveCard key={m.id} move={m} detailed />)}</div>
            </section>
          ))
        )}

        <Card title="Your actions" description={`${openTasks.length} open`} padded={false}>
          {tasks.length === 0 ? <div className="p-5"><EmptyState title="No actions assigned yet" /></div> : (
            <Table>
              <thead><tr><th>Action</th><th>Due</th><th>Status</th></tr></thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id}>
                    <td><p className="font-medium">{t.title}</p>{t.project && <p className="text-xs text-muted">{t.project.title}</p>}</td>
                    <td className="text-muted">{formatShortDate(t.dueDate)}</td>
                    <td><WorkStatusBadge s={t.status} /></td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
