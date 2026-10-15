import "server-only";
import { prisma } from "@/lib/prisma";

export async function activeProgramme() {
  return prisma.programme.findFirst({
    where: { active: true },
    include: { stages: { orderBy: { order: "asc" } }, milestones: { orderBy: { week: "asc" } } },
  });
}

export async function operatorOptions() {
  const ops = await prisma.operator.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  return ops.map((o) => ({ value: o.id, label: o.name }));
}

export async function staffOptions() {
  const users = await prisma.user.findMany({
    where: { role: { in: ["FOUNDER", "ADMIN", "PROGRAMME_MANAGER"] }, status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return users.map((u) => ({ value: u.id, label: u.name }));
}

export async function initiativeOptions() {
  const rows = await prisma.sharedInitiative.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } });
  return rows.map((r) => ({ value: r.id, label: r.title }));
}
