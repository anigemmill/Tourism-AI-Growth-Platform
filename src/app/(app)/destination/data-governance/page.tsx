import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getCurrentDestination } from "@/lib/destination";
import { getSession } from "@/lib/session";
import { Card, SectionHeading, EmptyState, Badge } from "@/components/ui";
import { ACCESS_LEVEL_LABELS } from "@/lib/governance";
import { ConnectorRunButton } from "@/components/ConnectorRunButton";
import { ImportForm } from "@/components/ImportForm";

export default async function DataGovernancePage() {
  await requirePermission("destination.view");
  const session = await getSession();
  const canManage = session.canManage;
  const destination = await getCurrentDestination();
  const [dataSources, importBatches] = destination
    ? await Promise.all([
        prisma.dataSource.findMany({ where: { destinationId: destination.id }, orderBy: { createdAt: "desc" } }),
        prisma.importBatch.findMany({
          where: { destinationId: destination.id },
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { dataSource: true },
        }),
      ])
    : [[], []];

  return (
    <div className="space-y-8">
      <SectionHeading
        title="Data Governance"
        description="Every data point in this platform is traceable to a registered source, with a data type, timestamp, geography, time period, confidence level and access level. This screen is that registry, plus the connector and import tools that populate it."
      />

      {canManage ? (
        <section className="grid md:grid-cols-2 gap-6">
          <Card>
            <h2 className="font-medium mb-3">Live connectors</h2>
            <p className="text-sm text-black/60 dark:text-white/60 mb-3">
              Open-Meteo (weather) and Nager.Date (public holidays) — see docs/CONNECTOR_STATUS.md for why they
              haven&apos;t been exercised end-to-end in this build environment.
            </p>
            <ConnectorRunButton />
          </Card>

          <Card>
            <h2 className="font-medium mb-3">Manual import</h2>
            <ImportForm />
          </Card>
        </section>
      ) : (
        <EmptyState
          title="Connectors and manual import require the “Import data & run connectors” permission"
          needs={["Switch your dev session role in the sidebar to try this."]}
        />
      )}

      <section>
        <h2 className="font-medium mb-3">Registered data sources</h2>
        {dataSources.length === 0 ? (
          <EmptyState title="No data sources registered" needs={["Run `npm run db:seed`"]} />
        ) : (
          <Card>
            <table className="w-full text-sm">
              <thead className="text-left text-black/50 dark:text-white/50">
                <tr>
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Organisation</th>
                  <th className="pb-2">Data type</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Default access</th>
                </tr>
              </thead>
              <tbody>
                {dataSources.map((s) => (
                  <tr key={s.id} className="border-t border-black/5 dark:border-white/10">
                    <td className="py-2 pr-2">{s.name}</td>
                    <td className="py-2 pr-2">{s.organisation}</td>
                    <td className="py-2 pr-2">{s.dataType}</td>
                    <td className="py-2 pr-2">{s.connectorStatus}</td>
                    <td className="py-2 pr-2">
                      <Badge tone={s.defaultAccessLevel}>{ACCESS_LEVEL_LABELS[s.defaultAccessLevel]}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      <section>
        <h2 className="font-medium mb-3">Import history</h2>
        {importBatches.length === 0 ? (
          <EmptyState title="No imports yet" needs={["Use the manual import form above"]} />
        ) : (
          <Card>
            <table className="w-full text-sm">
              <thead className="text-left text-black/50 dark:text-white/50">
                <tr>
                  <th className="pb-2">File</th>
                  <th className="pb-2">Target</th>
                  <th className="pb-2">Rows</th>
                  <th className="pb-2">Rejected</th>
                  <th className="pb-2">Uploaded by</th>
                  <th className="pb-2">When</th>
                </tr>
              </thead>
              <tbody>
                {importBatches.map((b) => (
                  <tr key={b.id} className="border-t border-black/5 dark:border-white/10">
                    <td className="py-2 pr-2">{b.fileName}</td>
                    <td className="py-2 pr-2">{b.targetTable}</td>
                    <td className="py-2 pr-2">{b.rowCount}</td>
                    <td className="py-2 pr-2">{b.rejectedCount}</td>
                    <td className="py-2 pr-2">{b.uploadedBy}</td>
                    <td className="py-2 pr-2">{b.createdAt.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </div>
  );
}
