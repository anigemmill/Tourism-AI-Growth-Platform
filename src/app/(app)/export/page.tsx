import { Badge, ButtonLink, Card, Notice, PageHeader, Table } from "@/components/ui";
import { requirePermission } from "@/lib/auth/session";
import { EXPORTS, exportableKeys, exportPermission } from "@/lib/export";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export default async function ExportPage() {
  const user = await requirePermission("data.export");
  const keys = exportableKeys(user.permissions);
  return (
    <div>
      <PageHeader eyebrow="Governance" title="Data export" description="Everything needed to keep running the programme outside this application — the low-tech fallback. Exports are logged." actions={<ButtonLink href="/api/export?entity=all" variant="primary">Download everything (JSON)</ButtonLink>} />
      <div className="mb-6"><Notice tone="warning">Exports contain confidential operator information. Store them securely and in line with each operator&apos;s data agreement. Password hashes and session tokens are never exported.</Notice></div>
      <Card padded={false}>
        <Table>
          <thead><tr><th>Dataset</th><th /><th className="text-right">Download</th></tr></thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k}>
                <td className="font-medium">{EXPORTS[k].label}</td>
                <td>{exportPermission(k) && <Badge tone="outline">Needs “{PERMISSIONS[exportPermission(k)!].label}”</Badge>}</td>
                <td className="space-x-3 text-right text-sm"><a className="text-accent hover:underline" href={`/api/export?entity=${k}&format=csv`}>CSV</a><a className="text-accent hover:underline" href={`/api/export?entity=${k}&format=json`}>JSON</a></td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
