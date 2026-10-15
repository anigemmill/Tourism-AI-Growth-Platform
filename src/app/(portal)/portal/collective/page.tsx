import { Badge, Card, EmptyState, PageHeader, Table, WorkStatusBadge } from "@/components/ui";
import { requireOperatorFeature } from "@/lib/auth/portal";
import { portalDirectory, portalInitiatives, portalLearnings, portalResources, portalWorkshops } from "@/lib/dal/portal";
import { formatDate, formatShortDate } from "@/lib/format";

export default async function PortalCollective() {
  const { user } = await requireOperatorFeature("portal.collective");
  const actor = { id: user.id, role: user.role, operatorId: user.operatorId };
  const [workshops, directory, learnings, resources, initiatives] = await Promise.all([
    portalWorkshops(actor), portalDirectory(actor), portalLearnings(actor), portalResources(actor), portalInitiatives(actor),
  ]);
  return (
    <div>
      <PageHeader eyebrow="Tourism AI Growth Collective" title="Growth Collective" description="Shared workshops, learnings and resources. Other operators' confidential information is never shown here." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Workshops" padded={false}>
            {workshops.length === 0 ? <div className="p-5"><EmptyState title="No workshops scheduled" /></div> : (
              <Table>
                <tbody>
                  {workshops.map((w) => (
                    <tr key={w.id}>
                      <td className="w-20 text-xs text-muted">Week {w.week}<br />{formatShortDate(w.date)}</td>
                      <td><p className="font-medium">{w.title}</p>{w.agenda && <p className="whitespace-pre-wrap text-xs text-muted">{w.agenda}</p>}<p className="text-xs text-subtle">{w.location}</p></td>
                      <td>{w.status === "DONE" ? <Badge tone={w.attendance[0]?.attended ? "success" : "outline"}>{w.attendance[0]?.attended ? "Attended" : "Held"}</Badge> : <Badge tone="info">Upcoming</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
          {initiatives.map((i) => (
            <Card key={i.id} title={i.title} description={`Shared initiative · ${i.initiativeType}`}>
              <p className="text-sm">{i.description}</p>
              {i.attributionMethod && <p className="mt-2 text-xs text-muted">Attribution: {i.attributionMethod}</p>}
              <ul className="mt-3 space-y-1 text-sm">{i.participants.map((p) => <li key={p.operator.name}><span className="font-medium">{p.operator.name}</span> <span className="text-muted">— {p.role}{p.responsibilities ? `: ${p.responsibilities}` : ""}</span></li>)}</ul>
              {i.tasks.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-line pt-3 text-sm">{i.tasks.map((t) => <li key={t.id} className="flex justify-between gap-2"><span>{t.title} <span className="text-xs text-subtle">· {t.ownerLabel ?? ""} · {formatShortDate(t.dueDate)}</span></span><WorkStatusBadge s={t.status} /></li>)}</ul>
              )}
            </Card>
          ))}
          <Card title="Shared learnings">
            {learnings.length === 0 ? <EmptyState title="No shared learnings yet" /> : (
              <ul className="space-y-4">
                {learnings.map((l) => (
                  <li key={l.id}>
                    <p className="font-medium">{l.title} {l.isReusableProcess && <Badge tone="accent">Reusable process</Badge>} {l.operatorId === user.operatorId && <Badge tone="warning">Yours</Badge>}</p>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted">{l.body}</p>
                    <p className="mt-0.5 text-xs text-subtle">{l.topic} · {formatDate(l.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Resources & templates">
            {resources.length === 0 ? <p className="text-sm text-muted">None yet.</p> : (
              <ul className="space-y-2 text-sm">{resources.map((r) => <li key={r.id}>{r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">{r.title}</a> : <span className="font-medium">{r.title}</span>}<p className="text-xs text-muted">{r.resourceType}{r.description ? ` · ${r.description}` : ""}</p></li>)}</ul>
            )}
          </Card>
          <Card title="Cohort directory">
            <ul className="space-y-1.5 text-sm">{directory.map((d) => <li key={d.id}><span className="font-medium">{d.name}</span> <span className="text-xs text-muted">· {d.category}</span></li>)}</ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
