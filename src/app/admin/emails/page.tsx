import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { EMAIL_TEMPLATES } from "@/lib/email";
import { emailSenderFrom } from "@/lib/emailLayout";
import EmailTemplateEditor from "./EmailTemplateEditor";

export const metadata: Metadata = { title: "E-mails" };

export default async function AdminEmailsPage() {
  const [overrides, settings] = await Promise.all([
    prisma.emailTemplate.findMany(),
    prisma.siteSettings.findUnique({ where: { id: 1 } }),
  ]);
  const sender = emailSenderFrom(settings);
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const overrideByKey = new Map(overrides.map((o) => [o.key, o]));

  const keys = Object.keys(EMAIL_TEMPLATES) as (keyof typeof EMAIL_TEMPLATES)[];

  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-2xl text-ink mb-1">E-mails</h1>
      <p className="text-sm text-inkSoft mb-6">
        Pas hier het onderwerp en de inhoud aan van elke e-mail die het systeem automatisch verstuurt. Elke mail krijgt
        dezelfde opmaak: de naam bovenaan, en onderaan de links en je adres uit Instellingen → Bedrijfsgegevens.
      </p>

      <div className="space-y-4">
        {keys.map((key) => {
          const template = EMAIL_TEMPLATES[key];
          const override = overrideByKey.get(key);
          return (
            <EmailTemplateEditor
              key={key}
              templateKey={key}
              label={template.label}
              description={template.description}
              placeholders={template.placeholders}
              subject={override?.subject ?? template.subject}
              bodyHtml={override?.bodyHtml ?? template.bodyHtml}
              isOverridden={Boolean(override)}
              sender={sender}
              appUrl={appUrl}
            />
          );
        })}
      </div>
    </div>
  );
}
