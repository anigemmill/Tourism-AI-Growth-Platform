import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, Badge, Card, DefinitionList, FormGrid, PageHeader, Select, Table, TextArea, TextField, WorkflowKindBadge, WorkflowStatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { operatorOptions } from "@/lib/queries";
import { CULTURAL_LABELS } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { addVersion, setUsage, updateAsset } from "../actions";
import { AssetFields } from "../AssetFields";

export default async function AssetPage({ params }: PageProps<"/library/[id]">) {
  await requirePermission("library.view");
  const { id } = await params;
  const a = await prisma.workflowAsset.findUnique({
    where: { id },
    include: { versions: { orderBy: { version: "desc" } }, usages: { include: { operator: { select: { id: true, name: true } } } }, templates: { select: { name: true } } },
  });
  if (!a) notFound();
  const operatorOpts = await operatorOptions();
  const current = a.versions[0];

  return (
    <div>
      <PageHeader eyebrow={<Link href="/library" className="hover:underline">Library</Link>} title={a.name} description={<span className="flex flex-wrap gap-1.5"><WorkflowKindBadge k={a.kind} /><WorkflowStatusBadge s={a.status} /><Badge tone="outline">v{a.currentVersion}</Badge>{a.culturalReview !== "NOT_APPLICABLE" && <Badge tone="warning">{CULTURAL_LABELS[a.culturalReview]}</Badge>}</span>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Overview">
            <DefinitionList items={[
              { label: "Purpose", value: a.purpose }, { label: "Problem", value: a.problem }, { label: "Intended user", value: a.intendedUser },
              { label: "Strategic initiative", value: a.strategicInitiative }, { label: "Inputs & data", value: a.inputs }, { label: "Expected output", value: a.expectedOutput },
              { label: "Tools", value: a.tools.join(", ") }, { label: "Permissions", value: a.permissions }, { label: "Human approval", value: a.humanApproval },
              { label: "Cost", value: a.costNotes }, { label: "Known limitations", value: a.limitations }, { label: "Test results", value: a.testResults },
              { label: "Evidence of value", value: a.evidenceOfValue }, { label: "Used by templates", value: a.templates.map((t) => t.name).join(", ") },
            ]} />
          </Card>
          <Card title={`Current instructions — v${current?.version ?? "—"}`} description={current ? `${current.createdBy} · ${formatDate(current.createdAt)} · ${current.changeNote ?? ""}` : undefined}>
            <pre className="whitespace-pre-wrap rounded-lg bg-surface-2 p-4 font-mono text-xs leading-relaxed text-ink">{current?.instructions}</pre>
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-accent">Save a new version</summary>
              <div className="mt-3">
                <ActionForm action={addVersion.bind(null, a.id)} submitLabel="Save new version">
                  <TextArea name="instructions" label="Instructions" required rows={10} defaultValue={current?.instructions} />
                  <TextField name="changeNote" label="What changed and why" required />
                </ActionForm>
              </div>
            </details>
          </Card>
          <Card title="Version history" padded={false}>
            <Table><tbody>{a.versions.map((v) => <tr key={v.id}><td className="w-14 font-medium">v{v.version}</td><td>{v.changeNote}</td><td className="text-xs text-muted">{v.createdBy}</td><td className="whitespace-nowrap text-xs text-muted">{formatDate(v.createdAt)}</td></tr>)}</tbody></Table>
          </Card>
          <details className="rounded-xl border border-line bg-surface">
            <summary className="cursor-pointer px-5 py-3.5 text-sm font-semibold">Edit record & status</summary>
            <div className="border-t border-line p-5"><ActionForm action={updateAsset.bind(null, a.id)} submitLabel="Save"><AssetFields a={a} /></ActionForm></div>
          </details>
        </div>
        <Card title="Operators using it">
          {a.usages.length === 0 ? <p className="text-sm text-muted">Not in use yet.</p> : (
            <ul className="space-y-2 text-sm">{a.usages.map((u) => <li key={u.id}><Link href={`/operators/${u.operator.id}`} className="font-medium hover:underline">{u.operator.name}</Link> <Badge tone={u.status === "in use" ? "success" : u.status === "stopped" ? "outline" : "info"}>{u.status}</Badge>{u.notes && <p className="text-xs text-muted">{u.notes}</p>}</li>)}</ul>
          )}
          <div className="mt-4 border-t border-line pt-4">
            <ActionForm action={setUsage.bind(null, a.id)} submitLabel="Save usage" resetOnSuccess>
              <FormGrid cols={1}>
                <Select name="operatorId" label="Operator" required options={operatorOpts} placeholder="Choose…" />
                <Select name="status" label="Status" options={["piloting", "in use", "stopped"].map((v) => ({ value: v, label: v }))} defaultValue="piloting" />
                <TextField name="notes" label="Notes" />
              </FormGrid>
            </ActionForm>
          </div>
        </Card>
      </div>
    </div>
  );
}
