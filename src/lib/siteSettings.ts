import { prisma } from "@/lib/prisma";

export async function getNoindexEnabled(): Promise<boolean> {
  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  return settings?.noindexEnabled ?? true;
}

export async function setNoindexEnabled(enabled: boolean): Promise<void> {
  await prisma.siteSettings.upsert({
    where: { id: 1 },
    create: { id: 1, noindexEnabled: enabled },
    update: { noindexEnabled: enabled },
  });
}

export async function getAutoPublishEnabled(): Promise<boolean> {
  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  return settings?.autoPublishEnabled ?? false;
}

export async function setAutoPublishEnabled(enabled: boolean): Promise<void> {
  await prisma.siteSettings.upsert({
    where: { id: 1 },
    create: { id: 1, autoPublishEnabled: enabled },
    update: { autoPublishEnabled: enabled },
  });
}
