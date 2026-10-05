"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { setNoindexEnabled, setAutoPublishEnabled, setButtonColors, setMenuColors } from "@/lib/siteSettings";
import { isHexColor } from "@/lib/buttonColors";
import { sellerDetailsSchema } from "@/lib/validations/billing";
import { deleteApiKey, isProvider, saveApiKey, testConnection } from "@/lib/apiCredentials";
import { deleteMailboxLogin, saveMailboxLogin, testMailbox } from "@/lib/mailbox";
import { refreshAllWebsiteMetrics } from "@/lib/websiteMetrics";
import { backupDownloadUrl, backupNow, backupTime, restoreFromKey } from "@/lib/databaseBackup";
import { moveLegacyFiles } from "@/lib/storageMigration";

type ActionState = { error: string | null; success: boolean };

const nameSchema = z.string().trim().min(2, "Minimaal 2 tekens").max(100);
const codeSchema = z.string().trim().min(2, "Minimaal 2 tekens").max(10);

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  return session?.user.role === "admin";
}

export async function setNoindexAction(enabled: boolean): Promise<ActionState> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan.", success: false };
  await setNoindexEnabled(enabled);
  return { error: null, success: true };
}

export async function setAutoPublishAction(enabled: boolean): Promise<ActionState> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan.", success: false };
  await setAutoPublishEnabled(enabled);
  return { error: null, success: true };
}

const buttonColorsSchema = z.object({
  pay: z.string().refine(isHexColor, "Ongeldige kleurcode"),
  primary: z.string().refine(isHexColor, "Ongeldige kleurcode"),
  primaryFilled: z.boolean(),
});

export async function setButtonColorsAction(input: unknown): Promise<ActionState> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan.", success: false };
  const parsed = buttonColorsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ongeldig", success: false };
  await setButtonColors({ ...parsed.data, pay: parsed.data.pay.toLowerCase(), primary: parsed.data.primary.toLowerCase() });
  return { error: null, success: true };
}

const hexColor = z.string().refine(isHexColor, "Ongeldige kleurcode").transform((c) => c.toLowerCase());
const menuColorsSchema = z.object({ buy: hexColor, manage: hexColor, admin: hexColor });

export async function setMenuColorsAction(input: unknown): Promise<ActionState> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan.", success: false };
  const parsed = menuColorsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ongeldig", success: false };
  await setMenuColors(parsed.data);
  return { error: null, success: true };
}

export async function setSellerDetailsAction(
  input: unknown
): Promise<ActionState & { values?: Record<string, string> }> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan.", success: false };
  const parsed = sellerDetailsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ongeldig", success: false };
  await prisma.siteSettings.upsert({ where: { id: 1 }, create: { id: 1, ...parsed.data }, update: parsed.data });
  return { error: null, success: true, values: parsed.data };
}

export async function addCategoryAction(name: string): Promise<ActionState> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan.", success: false };
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ongeldig", success: false };
  try {
    await prisma.category.create({ data: { name: parsed.data } });
    return { error: null, success: true };
  } catch {
    return { error: "Deze categorie bestaat al.", success: false };
  }
}

export async function deleteCategoryAction(id: string): Promise<ActionState> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan.", success: false };
  try {
    await prisma.category.delete({ where: { id } });
    return { error: null, success: true };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return { error: "Deze categorie is nog in gebruik door een of meer websites.", success: false };
    }
    return { error: "Verwijderen mislukt.", success: false };
  }
}

// Topics a link can be about besides Algemeen (Casino, Lening, ...). Removing
// one removes its prices on every site; orders keep the name they had.
export async function addTopicAction(name: string): Promise<ActionState> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan.", success: false };
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ongeldig", success: false };
  if (parsed.data.toLowerCase() === "algemeen") return { error: "Algemeen is er altijd al.", success: false };
  const last = await prisma.topic.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  try {
    await prisma.topic.create({ data: { name: parsed.data, sortOrder: (last?.sortOrder ?? 0) + 1 } });
    return { error: null, success: true };
  } catch {
    return { error: "Dit onderwerp bestaat al.", success: false };
  }
}

export async function deleteTopicAction(id: string): Promise<ActionState> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan.", success: false };
  await prisma.topic.deleteMany({ where: { id } });
  return { error: null, success: true };
}

export async function addCountryAction(name: string, code: string): Promise<ActionState> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan.", success: false };
  const parsedName = nameSchema.safeParse(name);
  const parsedCode = codeSchema.safeParse(code);
  if (!parsedName.success) return { error: parsedName.error.issues[0]?.message ?? "Ongeldig", success: false };
  if (!parsedCode.success) return { error: parsedCode.error.issues[0]?.message ?? "Ongeldig", success: false };
  try {
    await prisma.country.create({ data: { name: parsedName.data, code: parsedCode.data.toUpperCase() } });
    return { error: null, success: true };
  } catch {
    return { error: "Dit land of deze code bestaat al.", success: false };
  }
}

export async function deleteCountryAction(id: string): Promise<ActionState> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan.", success: false };
  try {
    await prisma.country.delete({ where: { id } });
    return { error: null, success: true };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return { error: "Dit land is nog in gebruik door een of meer websites.", success: false };
    }
    return { error: "Verwijderen mislukt.", success: false };
  }
}

export async function addLanguageAction(name: string, code: string): Promise<ActionState> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan.", success: false };
  const parsedName = nameSchema.safeParse(name);
  const parsedCode = codeSchema.safeParse(code);
  if (!parsedName.success) return { error: parsedName.error.issues[0]?.message ?? "Ongeldig", success: false };
  if (!parsedCode.success) return { error: parsedCode.error.issues[0]?.message ?? "Ongeldig", success: false };
  try {
    await prisma.language.create({ data: { name: parsedName.data, code: parsedCode.data.toLowerCase() } });
    return { error: null, success: true };
  } catch {
    return { error: "Deze taal of code bestaat al.", success: false };
  }
}

export async function deleteLanguageAction(id: string): Promise<ActionState> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan.", success: false };
  try {
    await prisma.language.delete({ where: { id } });
    return { error: null, success: true };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return { error: "Deze taal is nog in gebruik door een of meer websites.", success: false };
    }
    return { error: "Verwijderen mislukt.", success: false };
  }
}

// "Laat ons schrijven": what the customer pays on top of the placement.
// Items already in a cart keep the price they were added with until the
// customer saves them again.
export async function setWritingPriceAction(price: number): Promise<ActionState> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan.", success: false };
  const parsed = z.number().min(0, "Prijs kan niet negatief zijn").max(1000, "Maximaal €1000").safeParse(price);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ongeldig", success: false };
  const writingPrice = new Prisma.Decimal(parsed.data.toFixed(2));
  await prisma.siteSettings.upsert({ where: { id: 1 }, create: { id: 1, writingPrice }, update: { writingPrice } });
  return { error: null, success: true };
}

// API keys (Koppelingen): only ever written and tested here — they never
// travel back to the browser.
const apiKeySchema = z
  .string()
  .trim()
  .min(10, "Deze sleutel lijkt te kort.")
  .max(300, "Deze sleutel is te lang.")
  .regex(/^\S+$/, "Een sleutel heeft geen spaties.");

export async function saveApiKeyAction(provider: string, key: string): Promise<ActionState> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan.", success: false };
  if (!isProvider(provider)) return { error: "Onbekende koppeling.", success: false };
  const parsed = apiKeySchema.safeParse(key);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ongeldige sleutel.", success: false };
  await saveApiKey(provider, parsed.data);
  return { error: null, success: true };
}

export async function deleteApiKeyAction(provider: string): Promise<ActionState> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan.", success: false };
  if (!isProvider(provider)) return { error: "Onbekende koppeling.", success: false };
  await deleteApiKey(provider);
  return { error: null, success: true };
}

export async function testApiKeyAction(provider: string): Promise<{ ok: boolean; message: string }> {
  if (!(await requireAdmin())) return { ok: false, message: "Niet toegestaan." };
  if (!isProvider(provider)) return { ok: false, message: "Onbekende koppeling." };
  return testConnection(provider);
}

// The order mailbox (Admin → Binnengekomen): saved, then tested straight
// away so a typo shows at once. The password never goes back to the browser.
const mailboxSchema = z.object({
  host: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Vul de servernaam in, bijv. gukm1234.siteground.biz."),
  user: z.string().trim().toLowerCase().email("Vul het e-mailadres van de mailbox in."),
  password: z.string().min(1, "Vul het wachtwoord in.").max(200),
});

export async function saveMailboxAction(input: unknown): Promise<{ ok: boolean; message: string }> {
  if (!(await requireAdmin())) return { ok: false, message: "Niet toegestaan." };
  const parsed = mailboxSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Ongeldige invoer." };
  await saveMailboxLogin(parsed.data);
  return testMailbox(parsed.data);
}

// Your own addresses: a mail from one of these reads as a forward.
export async function saveOwnEmailsAction(text: string): Promise<{ ok: boolean; message: string }> {
  if (!(await requireAdmin())) return { ok: false, message: "Niet toegestaan." };
  const list = Array.from(new Set(String(text).toLowerCase().split(/[\s,;]+/).filter(Boolean)));
  const wrong = list.find((e) => !z.string().email().safeParse(e).success);
  if (wrong) return { ok: false, message: `"${wrong}" is geen geldig e-mailadres.` };
  if (list.length > 20) return { ok: false, message: "Maximaal 20 adressen." };
  await prisma.siteSettings.upsert({ where: { id: 1 }, create: { id: 1, ownEmails: list }, update: { ownEmails: list } });
  return { ok: true, message: "Opgeslagen." };
}

export async function deleteMailboxAction(): Promise<void> {
  if (!(await requireAdmin())) return;
  await deleteMailboxLogin();
}

export async function testMailboxAction(): Promise<{ ok: boolean; message: string }> {
  if (!(await requireAdmin())) return { ok: false, message: "Niet toegestaan." };
  return testMailbox();
}

export async function refreshAllMetricsAction(): Promise<{ ok: boolean; message: string }> {
  if (!(await requireAdmin())) return { ok: false, message: "Niet toegestaan." };
  const count = await refreshAllWebsiteMetrics();
  return {
    ok: true,
    message: `Bezig met ${count} ${count === 1 ? "website" : "websites"}. Dat duurt even; ververs de pagina straks.`,
  };
}

// Instellingen → Systeem: a database copy right now, next to the hourly one.
export async function backupNowAction(): Promise<{ ok: boolean; message: string }> {
  if (!(await requireAdmin())) return { ok: false, message: "Niet toegestaan." };
  try {
    const made = await backupNow();
    return { ok: true, message: `Kopie gemaakt (${(made.size / 1024).toFixed(0)} kB).` };
  } catch (err) {
    return { ok: false, message: `Kopie maken mislukt: ${err instanceof Error ? err.message : "onbekende fout"}` };
  }
}

// A short-lived download link for one copy; only database backups, never
// any other file in the bucket.
export async function backupDownloadUrlAction(key: string): Promise<{ url: string | null }> {
  if (!(await requireAdmin())) return { url: null };
  if (!backupTime(key)) return { url: null };
  return { url: await backupDownloadUrl(key) };
}

// Puts a copy back. The admin has to type TERUGZETTEN first; the current
// state is copied before anything changes, and nothing happens if that fails.
export async function restoreBackupAction(key: string, confirmation: string): Promise<{ ok: boolean; message: string }> {
  if (!(await requireAdmin())) return { ok: false, message: "Niet toegestaan." };
  if (confirmation.trim() !== "TERUGZETTEN") return { ok: false, message: "Typ TERUGZETTEN om te bevestigen." };
  if (!backupTime(key)) return { ok: false, message: "Onbekende back-up." };
  try {
    await restoreFromKey(key, { requireSafetyCopy: true });
    return { ok: true, message: "Teruggezet. De stand van vóór het terugzetten is als extra kopie bewaard." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Terugzetten mislukt." };
  }
}

// Off when Railway (Pro) takes over the backups.
export async function setOwnBackupsAction(enabled: boolean): Promise<ActionState> {
  if (!(await requireAdmin())) return { error: "Niet toegestaan.", success: false };
  await prisma.siteSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ownBackupsEnabled: enabled },
    update: { ownBackupsEnabled: enabled },
  });
  return { error: null, success: true };
}

// Copies what's left in the previous bucket into the new ones.
export async function moveLegacyFilesAction(): Promise<{ ok: boolean; message: string }> {
  if (!(await requireAdmin())) return { ok: false, message: "Niet toegestaan." };
  try {
    const { copied, failed, left } = await moveLegacyFiles();
    if (failed) return { ok: false, message: `${copied} overgezet, ${failed} mislukt. Probeer het nog eens.` };
    return { ok: true, message: left ? `${copied} overgezet, nog ${left} te gaan.` : `${copied} overgezet. Alles staat nu in de nieuwe opslag.` };
  } catch (err) {
    return { ok: false, message: `Overzetten mislukt: ${err instanceof Error ? err.message : "onbekende fout"}` };
  }
}
