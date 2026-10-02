"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { nextStatus } from "@/lib/launch";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  return session?.user.role === "admin";
}

// The menu shows the percentage, so the whole admin area is refreshed.
const refresh = () => revalidatePath("/admin", "layout");

export async function cycleLaunchItemAction(id: string) {
  if (!(await requireAdmin())) return;
  const item = await prisma.launchItem.findUnique({ where: { id: String(id) } });
  if (!item) return;
  await prisma.launchItem.update({ where: { id: item.id }, data: { status: nextStatus(item.status) } });
  refresh();
}

const newItemSchema = z.object({
  list: z.enum(["livegang", "nice", "algemeen"]),
  step: z.number().int().min(0).max(4),
  title: z.string().trim().min(2).max(120),
});

export async function addLaunchItemAction(input: unknown) {
  if (!(await requireAdmin())) return;
  const parsed = newItemSchema.safeParse(input);
  if (!parsed.success) return;
  const { list, title } = parsed.data;
  const step = list === "livegang" ? Math.max(parsed.data.step, 1) : 0;
  const last = await prisma.launchItem.aggregate({ where: { list, step }, _max: { position: true } });
  await prisma.launchItem.create({ data: { list, step, title, position: (last._max.position ?? -1) + 1 } });
  refresh();
}

const editSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(2).max(120),
  list: z.enum(["livegang", "nice", "algemeen"]),
  step: z.number().int().min(0).max(4),
});

// New wording, or moved to another list or step (it goes to the end there).
export async function updateLaunchItemAction(input: unknown) {
  if (!(await requireAdmin())) return;
  const parsed = editSchema.safeParse(input);
  if (!parsed.success) return;
  const { id, title, list } = parsed.data;
  const step = list === "livegang" ? Math.max(parsed.data.step, 1) : 0;
  const item = await prisma.launchItem.findUnique({ where: { id } });
  if (!item) return;
  let position = item.position;
  if (item.list !== list || item.step !== step) {
    const last = await prisma.launchItem.aggregate({ where: { list, step }, _max: { position: true } });
    position = (last._max.position ?? -1) + 1;
  }
  await prisma.launchItem.update({ where: { id }, data: { title, list, step, position } });
  refresh();
}

export async function deleteLaunchItemAction(id: string) {
  if (!(await requireAdmin())) return;
  await prisma.launchItem.deleteMany({ where: { id: String(id) } });
  refresh();
}

// yyyy-mm-dd from the date field, or empty to clear it.
export async function setLaunchDateAction(value: string) {
  if (!(await requireAdmin())) return;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : null;
  await prisma.siteSettings.upsert({
    where: { id: 1 },
    create: { id: 1, launchDate: date },
    update: { launchDate: date },
  });
  refresh();
}
