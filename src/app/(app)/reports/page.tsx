import Link from "next/link";
import { Badge, Card, PageHeader, Table } from "@/components/ui";
import { can, requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export default async function ReportsPage() {
  const user = await requirePermission("reports.view");
  const [ops, exps] = await Promise.all([
    prisma.operator.findMany({ where: { status: { notIn: ["WITHDRAWN", "PROSPECT"] } }, orderBy: { name: "asc" }, select: { id: true, name: true, consentCaseStudy: true } }),
    prisma.experiment.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, title: true, status: true } }),
  ]);
  const link = "font-medium text-accent hover:underline";
  return (
    <div>
      <PageHeader eyebrow="Intelligence" title="Reports" description="Generated from stored data. Each finding answers: what changed, what evidence supports it, why it matters, what happens next, who owns it and when it will be reviewed. Print to PDF or download Markdown to share outside the platform." />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card title={<Link href="/reports/founder" className={link}>Founder programme report</Link>}><p className="text-sm text-muted">Status, operators, risks, decisions{can(user, "commercial.view") ? ", commercial" : ""}.</p></Card>
        <Card title={<Link href="/reports/cohort" className={link}>Cohort learning summary</Link>}><p className="text-sm text-muted">Anonymised aggregate — consenting operators only. Foundation for Rotorua Pulse.</p></Card>
        {can(user, "commercial.view") && <Card title={<Link href="/reports/commercial" className={link}>Monthly commercial summary</Link>}><p className="text-sm text-muted">Proposed, quoted, contracted and received kept separate.</p></Card>}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Operator reports & case-study drafts" padded={false}>
          <Table><tbody>{ops.map((o) => <tr key={o.id}><td><Link href={`/reports/operator/${o.id}`} className="hover:underline">{o.name}</Link></td><td className="text-right">{o.consentCaseStudy ? <Link href={`/reports/case-study/${o.id}`} className="text-xs text-accent hover:underline">Case-study draft</Link> : <Badge tone="outline">No case-study consent</Badge>}</td></tr>)}</tbody></Table>
        </Card>
        <Card title="Experiment reports" padded={false}>
          <Table><tbody>{exps.map((e) => <tr key={e.id}><td><Link href={`/reports/experiment/${e.id}`} className="hover:underline">{e.title}</Link></td><td className="text-right text-xs text-muted">{e.status.toLowerCase()}</td></tr>)}</tbody></Table>
        </Card>
      </div>
    </div>
  );
}
