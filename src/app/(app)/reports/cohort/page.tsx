import { ReportView } from "@/components/ReportView";
import { requirePermission } from "@/lib/auth/session";
import { cohortReport } from "@/lib/reports/build";

export default async function Page() {
  await requirePermission("reports.view");
  return <ReportView report={await cohortReport()} downloadHref="/api/reports?type=cohort" />;
}
