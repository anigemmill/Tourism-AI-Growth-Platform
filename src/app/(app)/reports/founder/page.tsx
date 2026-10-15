import { ReportView } from "@/components/ReportView";
import { can, requirePermission } from "@/lib/auth/session";
import { founderReport } from "@/lib/reports/build";

export default async function Page() {
  const user = await requirePermission("reports.view");
  return <ReportView report={await founderReport(can(user, "commercial.view"))} downloadHref="/api/reports?type=founder" />;
}
