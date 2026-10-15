import { Card, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth/session";
import { initiativeOptions, operatorOptions } from "@/lib/queries";
import { opportunityOptions } from "@/lib/opportunityOptions";
import { createProject } from "../../actions";
import { ProjectForm } from "../../ProjectForm";

export default async function NewProjectPage({ searchParams }: PageProps<"/work/projects/new">) {
  await requirePermission("work.edit");
  const sp = await searchParams;
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const [operatorOpts, initiativeOpts, opportunityOpts] = await Promise.all([operatorOptions(), initiativeOptions(), opportunityOptions()]);
  return (
    <div>
      <PageHeader eyebrow="Projects & tasks" title="New implementation project" />
      <Card>
        <ProjectForm action={createProject} defaults={{ operatorId: s("operatorId"), opportunityId: s("opportunityId"), initiativeId: s("initiativeId") }} operatorOpts={operatorOpts} initiativeOpts={initiativeOpts} opportunityOpts={opportunityOpts} submitLabel="Create project" />
      </Card>
    </div>
  );
}
