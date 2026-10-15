import { ReportView } from "@/components/ReportView";
import { requirePermission } from "@/lib/auth/session";
import { commercialReport } from "@/lib/reports/build";

export default async function Page() {
  await requirePermission("commercial.view");
  return <ReportView report={await commercialReport()} downloadHref="/api/reports?type=commercial" />;
}
