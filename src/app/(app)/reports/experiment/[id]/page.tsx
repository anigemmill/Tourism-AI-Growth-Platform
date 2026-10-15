import { notFound } from "next/navigation";
import { ReportView } from "@/components/ReportView";
import { requirePermission } from "@/lib/auth/session";
import { experimentReport } from "@/lib/reports/build";

export default async function Page({ params }: PageProps<"/reports/experiment/[id]">) {
  await requirePermission("reports.view");
  const { id } = await params;
  const report = await experimentReport(id);
  if (!report) notFound();
  return <ReportView report={report} downloadHref={`/api/reports?type=experiment&id=${id}`} />;
}
