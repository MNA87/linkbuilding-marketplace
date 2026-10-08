import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { FoundLink } from "@/lib/inboundParse";
import { AskShareButton, RefetchDocButton, StatusButton } from "../MailButtons";
import { CreateOrderForm, NewCustomerForm } from "../MailOrderForms";
import { LinksEditor } from "../LinksEditor";
import { MAX_BRIEF_LINKS } from "@/lib/writingService";
import { companyDomain, companyNameFromEmail, isOwnAddress } from "@/lib/inboundCustomer";
import { findForwarded, findGoogleDocUrl, parseRequests, splitSenderName } from "@/lib/inboundParse";
import { computePriceForWebsiteProduct } from "@/lib/pricing";
import { customerTerms, priceSourceLabel, writingFeeFor } from "@/lib/customerPricing";
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
      customer: { select: { name: true, email: true, company: { select: { id: true, name: true } } } },
      website: { select: { domain: true } },
      orderItem: { select: { id: true, order: { select: { orderNumber: true } } } },
    },
  });
  if (!mail) notFound();
  // A forward saved under your own address (read before the sender could be
  // found in it) is read again for the new customer.
  const ownEmails =
    (await prisma.siteSettings.findUnique({ where: { id: 1 }, select: { ownEmails: true } }))?.ownEmails ?? [];
  const fromOwn = isOwnAddress(mail.fromEmail, ownEmails);
  const sender = (fromOwn && findForwarded(mail.text, ownEmails)) || {
    fromEmail: mail.fromEmail,
    fromName: mail.fromName,
  };
  const senderIsOwn = isOwnAddress(sender.fromEmail, ownEmails);
  // A customer made from your own address (before that was refused) isn't one.
  const customer = mail.customer && !isOwnAddress(mail.customer.email, ownEmails) ? mail.customer : null;
  // A Google Doc linked loosely in an older mail is read on request too.
  const docUrl = mail.docUrl ?? (mail.isReply ? null : findGoogleDocUrl(mail.text));
  // With several, reading them makes a request of each.
  const docCount = mail.docUrl || mail.requestLabel || mail.isReply ? 0 : parseRequests(mail.text).length;
  const euro = (n: number) => `€${n.toFixed(2).replace(".", ",")}`;
  // Prices as agreed with this customer, with where they come from.
  const companyId = customer?.company?.id ?? null;
  const [products, terms, writingFee] = await Promise.all([
    prisma.websiteProduct.findMany({
      where: { product: { type: "BLOG_POST" } },
      select: { id: true, website: { select: { id: true, domain: true } } },
      orderBy: { website: { domain: "asc" } },
    }),
    customerTerms(companyId),
    writingFeeFor(companyId),
  ]);
  const websites = await Promise.all(
    products.map(async (p) => {
      const { customerPrice, standardPrice, source } = await computePriceForWebsiteProduct(p.id, companyId);
      return {
        id: p.website.id,
        domain: p.website.domain,
        price: euro(customerPrice.toNumber()),
        note:
          source === "standard"
            ? null
            : `${priceSourceLabel(source, terms)}, standaard ${euro(standardPrice.toNumber())}`,
      };
    })
  );
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
          <div className="mt-3 whitespace-pre-wrap break-words text-sm text-ink/90">
            {mail.text.trim() || "(geen tekst)"}
          </div>
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
          {mail.fileNote && (
            <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {mail.fileNote}
            </p>
          )}
        </section>

        <section className="rounded-lg border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-inkSoft">Wat het platform herkende</div>
            <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.style}`}>
              {status.label}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="text-xs text-inkSoft">
              Klant
              <div className={field}>
                {customer ? (
                  (customer.company?.name ?? customer.name)
                ) : (
                  <span className="text-red-700">Nog geen klant</span>
                )}
              </div>
            </div>
            <div className="text-xs text-inkSoft">
              Soort
              <div className={field}>
                {mail.isReply
                  ? "Antwoord"
                  : docUrl
                    ? "Blogartikel · Google Doc"
                    : mail.articleTitle
                      ? "Blogartikel · artikel aangeleverd"
                      : "Blogartikel · Laat ons schrijven"}
              </div>
            </div>
          </div>
          {!customer && !mail.isReply && mail.status !== "done" && (
            <NewCustomerForm
              mailId={mail.id}
              company={
                senderIsOwn ? "" : splitSenderName(sender.fromName).company || companyNameFromEmail(sender.fromEmail)
              }
              name={senderIsOwn ? "" : splitSenderName(sender.fromName).name}
              email={senderIsOwn ? "" : sender.fromEmail}
              domain={senderIsOwn ? null : companyDomain(sender.fromEmail)}
              ownWarning={senderIsOwn}
            />
          )}

          {(mail.requestLabel || docUrl) && (
            <div className="mt-3 rounded-lg border border-line bg-gray-50 p-3 text-sm">
              <div className="font-semibold text-ink">Aanvraag{mail.requestLabel ? ` ${mail.requestLabel}` : ""}</div>
              <dl className="mt-1.5 grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1">
                {mail.fileName && (
                  <>
                    <dt className="text-inkSoft">Word-bestand</dt>
                    <dd className="break-all text-ink">{mail.fileName}</dd>
                  </>
                )}
                {mail.endClient && (
                  <>
                    <dt className="text-inkSoft">Klant van partner</dt>
                    <dd className="text-ink">{mail.endClient}</dd>
                  </>
                )}
                {mail.externalRef && (
                  <>
                    <dt className="text-inkSoft">Order ID</dt>
                    <dd className="text-ink">{mail.externalRef}</dd>
                  </>
                )}
                {mail.quotedPrice && (
                  <>
                    <dt className="text-inkSoft">Tarief in mail</dt>
                    <dd className="text-ink">{euro(mail.quotedPrice.toNumber())}</dd>
                  </>
                )}
                {docUrl && (
                  <>
                    <dt className="text-inkSoft">Google Doc</dt>
                    <dd className="min-w-0">
                      <a
                        href={docUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="break-all text-brand hover:underline"
                      >
                        Openen
                      </a>
                      {mail.docError ? (
                        <span className="mt-1 block text-red-700">{mail.docError}</span>
                      ) : mail.articleTitle ? (
                        <span className="ml-2 text-emerald-700">· ingelezen</span>
                      ) : (
                        <span className="ml-2 text-amber-700">· nog niet ingelezen</span>
                      )}
                    </dd>
                  </>
                )}
              </dl>
              {docUrl && (mail.docError || !mail.articleTitle) && mail.status !== "done" && (
                <div className="mt-2">
                  {docCount > 1 && (
                    <p className="mb-2 text-xs text-inkSoft">
                      Er staan {docCount} Google Docs in deze mail. Elk wordt een eigen aanvraag.
                    </p>
                  )}
                  <RefetchDocButton
                    id={mail.id}
                    label={
                      mail.docError
                        ? "Opnieuw ophalen"
                        : docCount > 1
                          ? `${docCount} Google Docs inlezen`
                          : "Google Doc inlezen"
                    }
                  />
                  {mail.docError?.includes("niet gedeeld") && (
                    <span className="ml-2">
                      <AskShareButton id={mail.id} askedOn={mail.shareAskedAt ? mailTime(mail.shareAskedAt) : null} />
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

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

          {!mail.isReply && (
            <LinksEditor
              // Starts over when the links change (after reading the Google Docs).
              key={JSON.stringify(links)}
              mailId={mail.id}
              links={links}
              editable={mail.status !== "done"}
              maxInOrder={mail.status === "done" ? null : MAX_BRIEF_LINKS}
              inArticle={Boolean(mail.articleBody)}
            />
          )}

          {mail.orderItem && (
            <div className="mt-4 rounded-lg bg-[var(--pay-soft)] px-3 py-2 text-sm text-ink">
              {mail.isReply ? "Antwoord op " : "Order gemaakt: "}
              <Link
                href={`/admin/orders/${mail.orderItem.id}`}
                className="font-semibold text-[var(--btn-pay-bg)] hover:underline"
              >
                order #{mail.orderItem.order.orderNumber} →
              </Link>
            </div>
          )}

          {mail.status === "new" && !mail.isReply && (
            <CreateOrderForm
              // Starts over when the site found for it changes (after reading the Google Docs).
              key={mail.websiteId ?? ""}
              mailId={mail.id}
              websites={websites}
              websiteId={mail.websiteId}
              canOrder={Boolean(customer)}
              writeForMe={!mail.articleTitle && !docUrl}
              writingFee={writingFee.isZero() ? null : euro(writingFee.toNumber())}
            />
          )}
          {(mail.status === "ignored" || (mail.isReply && mail.status === "new")) && (
            <div className="mt-4 flex justify-end">
              <StatusButton id={mail.id} ignored={mail.status === "ignored"} reply={mail.isReply} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
