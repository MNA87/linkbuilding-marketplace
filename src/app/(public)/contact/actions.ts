"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sendContactFormEmail } from "@/lib/email";
import { isRateLimited } from "@/lib/rateLimit";
import { getSiteSettings } from "@/lib/cms/content";
import { CONTACT_SUBJECTS, contactSchema } from "@/lib/validations/contact";

export async function contactAction(input: unknown): Promise<{ ok: boolean; message: string }> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  }

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(`contact:${ip}`, 3, 10 * 60_000)) {
    return { ok: false, message: "Je hebt net al een bericht gestuurd. Probeer het over een paar minuten opnieuw." };
  }

  const { settings } = await getSiteSettings();
  const fallbackEmail = settings.contact.contactEmail;
  const label = CONTACT_SUBJECTS.find((s) => s.value === parsed.data.subject)?.label ?? parsed.data.subject;
  const admins = await prisma.user
    .findMany({ where: { role: { name: "admin" } }, select: { email: true } })
    .catch(() => [] as { email: string }[]);
  const recipients = admins.length ? admins.map((a) => a.email) : [fallbackEmail];

  const results = await Promise.all(
    recipients.map((to) => sendContactFormEmail(to, { ...parsed.data, subject: label }))
  );
  if (!results.some(Boolean)) {
    return { ok: false, message: `Versturen lukte niet. Mail ons direct op ${fallbackEmail}.` };
  }
  return { ok: true, message: "Bedankt! We nemen binnen twee werkdagen contact met je op." };
}
