import { notFound } from "next/navigation";
import { EmptyState, PageHeader } from "@/components/ui";
import { ReportView } from "@/components/ReportView";
import { requirePermission } from "@/lib/auth/session";
import { caseStudyDraft } from "@/lib/reports/build";

export default async function Page({ params }: PageProps<"/reports/case-study/[id]">) {
  await requirePermission("reports.view");
  const { id } = await params;
  const result = await caseStudyDraft(id);
  const report = result && "blocked" in result ? result.report : result;
  if (result && "blocked" in result && result.blocked) {
    return <div><PageHeader eyebrow="Report" title="Case study draft" /><EmptyState title="Not available">{result.blocked}</EmptyState></div>;
  }
  if (!report) notFound();
  return <ReportView report={report} downloadHref={`/api/reports?type=case-study&id=${id}`} />;
}
