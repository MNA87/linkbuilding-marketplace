import { prisma } from "@/lib/prisma";
import { DEFAULT_BUTTON_COLORS, type ButtonColors } from "@/lib/buttonColors";

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

export async function getButtonColors(): Promise<ButtonColors> {
  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  if (!settings) return DEFAULT_BUTTON_COLORS;
  return { pay: settings.payButtonColor, primary: settings.primaryButtonColor, primaryFilled: settings.primaryButtonFilled };
}

export async function setButtonColors(colors: ButtonColors): Promise<void> {
  const data = { payButtonColor: colors.pay, primaryButtonColor: colors.primary, primaryButtonFilled: colors.primaryFilled };
  await prisma.siteSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
}
