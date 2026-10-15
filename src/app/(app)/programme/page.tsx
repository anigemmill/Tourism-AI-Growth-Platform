import Link from "next/link";
import { ActionForm, Badge, Card, EmptyState, FormGrid, PageHeader, Progress, TextArea, TextField, WorkStatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { activeProgramme } from "@/lib/queries";
import { programmePhaseLabel, programmeWeek, weekEnd, weekStart } from "@/lib/domain/programme";
import { WORK_STATUS_LABELS } from "@/lib/labels";
import { formatShortDate, toDateInput } from "@/lib/format";
import { addMilestone, setMilestoneStatus, updateProgramme, updateStages } from "./actions";

export default async function ProgrammePage() {
  await requirePermission("programme.view");
  const p = await activeProgramme();
  if (!p) return <EmptyState title="No active programme">Run the seed to create the programme skeleton.</EmptyState>;
  const now = new Date();
  const week = programmeWeek(p.startDate, now, p.totalWeeks);
  const workshops = await prisma.workshop.findMany({ where: { programmeId: p.id }, orderBy: { week: "asc" } });

  return (
    <div>
      <PageHeader eyebrow="Programme" title={p.name} description={`${programmePhaseLabel(week, p.totalWeeks)} · starts ${formatShortDate(p.startDate)} · ends ${formatShortDate(weekEnd(p.startDate, p.totalWeeks))}. All dates derive from the start date and week numbers — change the start date and everything moves with it.`} />

      <Card className="mb-6" padded={false}>
        <div className="overflow-x-auto p-5">
          <div className="min-w-[720px]">
            <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${p.totalWeeks}, minmax(0, 1fr))` }}>
              {Array.from({ length: p.totalWeeks }, (_, i) => i + 1).map((w) => (
                <div key={w} className={`rounded-sm px-1 py-1.5 text-center text-[11px] ${w === week ? "bg-accent font-semibold text-accent-ink" : w < week ? "bg-accent-soft text-accent" : "bg-surface-2 text-subtle"}`}>
                  Wk {w}<div className="text-[10px] opacity-80">{formatShortDate(weekStart(p.startDate, w))}</div>
                </div>
              ))}
            </div>
            <div className="mt-2 grid gap-px" style={{ gridTemplateColumns: `repeat(${p.totalWeeks}, minmax(0, 1fr))` }}>
              {p.stages.map((s) => (
                <div key={s.id} className="rounded-md border border-line bg-surface px-2 py-1.5 text-xs" style={{ gridColumn: `${s.startWeek} / ${s.endWeek + 1}` }}>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-subtle">Weeks {s.startWeek}–{s.endWeek}</p>
                </div>
              ))}
            </div>
            <div className="mt-2 grid gap-px" style={{ gridTemplateColumns: `repeat(${p.totalWeeks}, minmax(0, 1fr))` }}>
              {workshops.map((w) => (
                <Link key={w.id} href={`/collective/workshops/${w.id}`} className="truncate rounded-sm bg-info-soft px-1.5 py-1 text-[11px] text-info hover:underline" style={{ gridColumn: `${w.week} / ${w.week + 1}` }} title={w.title}>
                  ◆ {w.title}
                </Link>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t border-line px-5 py-3"><Progress value={Math.min(week, p.totalWeeks)} max={p.totalWeeks} label="Programme progress" /></div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Stages & goals">
            <div className="mb-5 grid gap-4 sm:grid-cols-2">
              {p.stages.map((s) => (
                <div key={s.id} className={`rounded-lg border p-4 ${week >= s.startWeek && week <= s.endWeek ? "border-accent" : "border-line"}`}>
                  <p className="text-sm font-semibold">{s.name} <span className="font-normal text-subtle">· wk {s.startWeek}–{s.endWeek}</span></p>
                  <ul className="mt-2 list-disc space-y-0.5 pl-4 text-sm text-muted">{s.goals.map((g) => <li key={g}>{g}</li>)}</ul>
                </div>
              ))}
            </div>
            <details>
              <summary className="cursor-pointer text-sm font-medium text-accent">Edit stages</summary>
              <div className="mt-4">
                <ActionForm action={updateStages.bind(null, p.id)} submitLabel="Save stages">
                  {p.stages.map((s) => (
                    <fieldset key={s.id} className="rounded-lg border border-line p-4">
                      <FormGrid cols={3}>
                        <TextField name={`${s.id}.name`} label="Stage" defaultValue={s.name} />
                        <TextField name={`${s.id}.startWeek`} label="Start week" type="number" step="1" defaultValue={s.startWeek} />
                        <TextField name={`${s.id}.endWeek`} label="End week" type="number" step="1" defaultValue={s.endWeek} />
                      </FormGrid>
                      <div className="mt-3"><TextArea name={`${s.id}.goals`} label="Goals (one per line)" defaultValue={s.goals.join("\n")} rows={3} /></div>
                    </fieldset>
                  ))}
                </ActionForm>
              </div>
            </details>
          </Card>
          <Card title="Milestones" padded={false}>
            <ul className="divide-y divide-line">
              {p.milestones.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="text-sm font-medium">{m.title}</p>
                    <p className="text-xs text-subtle">Week {m.week} · {formatShortDate(weekStart(p.startDate, m.week))} {m.status !== "DONE" && m.week < week && <Badge tone="danger">Overdue</Badge>}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <WorkStatusBadge s={m.status} />
                    <ActionForm action={setMilestoneStatus.bind(null, m.id)} inline submitLabel="Set" variant="ghost">
                      <label className="sr-only" htmlFor={`ms-${m.id}`}>Status</label>
                      <select id={`ms-${m.id}`} name="status" defaultValue={m.status} className="rounded-md border border-line-strong bg-surface px-2 py-1 text-xs">
                        {Object.entries(WORK_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </ActionForm>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-line p-5">
              <ActionForm action={addMilestone.bind(null, p.id)} submitLabel="Add milestone" resetOnSuccess>
                <FormGrid cols={3}>
                  <TextField name="title" label="Milestone" required className="sm:col-span-2" />
                  <TextField name="week" label="Week" type="number" step="1" min={1} max={p.totalWeeks} required />
                </FormGrid>
              </ActionForm>
            </div>
          </Card>
        </div>
        <div>
          <Card title="Programme settings">
            <ActionForm action={updateProgramme.bind(null, p.id)} submitLabel="Save settings">
              <TextField name="name" label="Name" defaultValue={p.name} required />
              <TextField name="startDate" label="Start date (week 1)" type="date" defaultValue={toDateInput(p.startDate)} required />
              <TextField name="totalWeeks" label="Total weeks" type="number" step="1" min={1} max={52} defaultValue={p.totalWeeks} required />
              <TextArea name="description" label="Description" defaultValue={p.description} />
            </ActionForm>
          </Card>
        </div>
      </div>
    </div>
  );
}
