import { NextResponse, type NextRequest } from "next/server";
import { can, getCurrentUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { caseStudyDraft, cohortReport, commercialReport, experimentReport, founderReport, operatorReport } from "@/lib/reports/build";
import { toMarkdown, type Report } from "@/lib/reports/types";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user, "reports.view")) return NextResponse.json({ error: "Programme staff only." }, { status: 403 });
  const type = req.nextUrl.searchParams.get("type");
  const id = req.nextUrl.searchParams.get("id") ?? "";
  let report: Report | null = null;
  switch (type) {
    case "operator": report = await operatorReport(id); break;
    case "experiment": report = await experimentReport(id); break;
    case "cohort": report = await cohortReport(); break;
    case "founder": report = await founderReport(can(user, "commercial.view")); break;
    case "case-study": report = (await caseStudyDraft(id)).report; break;
    case "commercial":
      if (!can(user, "commercial.view")) return NextResponse.json({ error: "You don't have permission to view commercial reports." }, { status: 403 });
      report = await commercialReport();
      break;
    default:
      return NextResponse.json({ error: "Unknown report type." }, { status: 400 });
  }
  if (!report) return NextResponse.json({ error: "Not found or not permitted." }, { status: 404 });
  await audit(user.id, "export", "report", id || type, `Downloaded ${type} report`);
  const name = `${type}-${new Date().toISOString().slice(0, 10)}.md`;
  return new NextResponse(toMarkdown(report), {
    headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": `attachment; filename="${name}"`, "cache-control": "no-store" },
  });
}
