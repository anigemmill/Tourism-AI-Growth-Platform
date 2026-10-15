import { notFound } from "next/navigation";
import { ReportView } from "@/components/ReportView";
import { requirePermission } from "@/lib/auth/session";
import { operatorReport } from "@/lib/reports/build";

export default async function Page({ params }: PageProps<"/reports/operator/[id]">) {
  await requirePermission("reports.view");
  const { id } = await params;
  const report = await operatorReport(id);
  if (!report) notFound();
  return <ReportView report={report} downloadHref={`/api/reports?type=operator&id=${id}`} />;
}
