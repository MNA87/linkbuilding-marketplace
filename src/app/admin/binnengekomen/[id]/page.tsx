import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { FoundLink } from "@/lib/inboundParse";
import { StatusButton } from "../MailButtons";
import { CreateOrderForm, NewCustomerForm } from "../MailOrderForms";
import { companyDomain, companyNameFromEmail } from "@/lib/inboundCustomer";
import { splitSenderName } from "@/lib/inboundParse";
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
  const euro = (n: number) => `€${n.toFixed(2).replace(".", ",")}`;
  // Prices as agreed with this customer, with where they come from.
  const companyId = mail.customer?.company?.id ?? null;
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
        note: source === "standard" ? null : `${priceSourceLabel(source, terms)}, standaard ${euro(standardPrice.toNumber())}`,
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
                {mail.customer ? (
                  (mail.customer.company?.name ?? mail.customer.name)
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
                  : mail.articleTitle
                    ? "Blogartikel · artikel aangeleverd"
                    : "Blogartikel · Laat ons schrijven"}
              </div>
            </div>
          </div>
          {!mail.customer && !mail.isReply && mail.status !== "done" && (
            <NewCustomerForm
              mailId={mail.id}
              company={splitSenderName(mail.fromName).company || companyNameFromEmail(mail.fromEmail)}
              name={splitSenderName(mail.fromName).name}
              email={mail.fromEmail}
              domain={companyDomain(mail.fromEmail)}
            />
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
              mailId={mail.id}
              websites={websites}
              websiteId={mail.websiteId}
              canOrder={Boolean(mail.customer)}
              writeForMe={!mail.articleTitle}
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
