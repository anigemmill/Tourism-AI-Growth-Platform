import { Card, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth/session";
import { initiativeOptions, operatorOptions } from "@/lib/queries";
import { opportunityOptions } from "@/lib/opportunityOptions";
import { experimentOptions } from "@/lib/experimentOptions";
import { createExperiment } from "../actions";
import { ExperimentForm } from "../ExperimentForm";

export default async function NewExperimentPage({ searchParams }: PageProps<"/experiments/new">) {
  await requirePermission("experiments.edit");
  const sp = await searchParams;
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const [operatorOpts, initiativeOpts, opportunityOpts, experimentOpts] = await Promise.all([operatorOptions(), initiativeOptions(), opportunityOptions(), experimentOptions()]);
  return (
    <div>
      <PageHeader eyebrow="Experiments" title="Design an experiment" description="Define the hypothesis, comparison method and success thresholds before anything changes." />
      <Card>
        <ExperimentForm action={createExperiment} defaults={{ operatorId: s("operatorId"), initiativeId: s("initiativeId"), opportunityId: s("opportunityId") }} operatorOpts={operatorOpts} initiativeOpts={initiativeOpts} opportunityOpts={opportunityOpts} experimentOpts={experimentOpts} submitLabel="Create experiment" />
      </Card>
    </div>
  );
}
