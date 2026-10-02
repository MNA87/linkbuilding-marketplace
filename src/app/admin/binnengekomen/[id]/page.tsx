import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { FoundLink } from "@/lib/inboundParse";
import { StatusButton } from "../MailButtons";
import { mailStatus, mailTime } from "../mailStatus";

export const metadata: Metadata = { title: "Binnengekomen" };

const field = "mt-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink";

// One mail: what was sent on the left, what the platform read from it on
// the right.
export default async function InboundMailDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mail = await prisma.inboundMail.findUnique({
    where: { id },
    include: {
      customer: { select: { name: true, email: true, company: { select: { name: true } } } },
      website: { select: { domain: true } },
    },
  });
  if (!mail) notFound();
  const status = mailStatus(mail);
  const links = (Array.isArray(mail.links) ? mail.links : []) as FoundLink[];
  const unread = mail.attachments.filter((a) => !(mail.articleTitle && /\.docx$/i.test(a)));

  return (
    <div className="max-w-6xl">
      <Link href="/admin/binnengekomen" className="text-sm text-brand hover:underline">
        &larr; Terug naar Binnengekomen
      </Link>

      <div className="mt-3 grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <section className="rounded-lg border border-line bg-surface p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-inkSoft">De mail</div>
          <div className="mt-2 font-medium text-ink">{mail.subject}</div>
          <div className="text-xs text-inkSoft">
            Van: {mail.fromName ? `${mail.fromName} · ` : ""}
            {mail.fromEmail} · {mailTime(mail.receivedAt)}
          </div>
          {mail.forwardedBy && <div className="text-xs text-inkSoft">Doorgestuurd door {mail.forwardedBy}</div>}
          <div className="mt-3 whitespace-pre-wrap break-words text-sm text-ink/90">{mail.text.trim() || "(geen tekst)"}</div>
          {mail.attachments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {mail.attachments.map((a, i) => (
                <span key={i} className="rounded-md border border-line bg-gray-50 px-2.5 py-1.5 text-sm text-ink">
                  Bijlage: {a}
                </span>
              ))}
            </div>
          )}
          {unread.length > 0 && (
            <p className="mt-2 text-xs text-inkSoft">
              Alleen Word-bestanden (.docx) worden ingelezen; open de andere bijlagen in je mailbox.
            </p>
          )}
        </section>

        <section className="rounded-lg border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-inkSoft">Wat het platform herkende</div>
            <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.style}`}>{status.label}</span>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="text-xs text-inkSoft">
              Klant
              <div className={field}>
                {mail.customer ? (
                  (mail.customer.company?.name ?? mail.customer.name)
                ) : (
                  <span className="text-red-700">Geen klant met {mail.fromEmail}</span>
                )}
              </div>
            </div>
            <div className="text-xs text-inkSoft">
              Website
              <div className={field}>{mail.website?.domain ?? <span className="text-inkSoft">Niet gevonden in de mail</span>}</div>
            </div>
          </div>

          {mail.articleTitle && (
            <div className="mt-3 text-xs text-inkSoft">
              Titel
              <div className={field}>{mail.articleTitle}</div>
            </div>
          )}
          {mail.articleBody && (
            <div className="mt-3 text-xs text-inkSoft">
              Tekst
              <div
                className="prose-content mt-1 max-h-72 overflow-y-auto rounded-lg border border-line p-3 text-sm text-ink/90"
                dangerouslySetInnerHTML={{ __html: mail.articleBody }}
              />
            </div>
          )}

          <div className="mt-3 text-xs text-inkSoft">
            Links
            {links.length > 0 ? (
              <div className="mt-1 divide-y divide-line rounded-lg border border-line">
                {links.map((l, i) => (
                  <div key={i} className="break-words px-3 py-2 text-sm">
                    <span className="text-ink">&ldquo;{l.anchor || "zonder ankertekst"}&rdquo;</span>{" "}
                    <span className="text-inkSoft">→ {l.url}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className={`${field} text-inkSoft`}>Geen links gevonden</div>
            )}
          </div>

          <div className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-sm text-inkSoft">
            Hier komt straks de knop &lsquo;Order aanmaken&rsquo; (op rekening).
          </div>

          {mail.status !== "done" && (
            <div className="mt-4 flex justify-end">
              <StatusButton id={mail.id} ignored={mail.status === "ignored"} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
