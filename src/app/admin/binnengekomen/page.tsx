import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { mailboxStatus } from "@/lib/mailbox";
import { FetchNowButton } from "./MailButtons";
import InboundList from "./InboundList";
import { delivered, mailStatus, mailTime } from "./mailStatus";

export const metadata: Metadata = { title: "Binnengekomen" };

// Orders that came in by mail (seo@…), read and waiting to be checked.
export default async function InboundMailPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const tab = (await searchParams).tab === "afgehandeld" ? "afgehandeld" : "nieuw";
  const [mails, counts, mailbox] = await Promise.all([
    prisma.inboundMail.findMany({
      where: tab === "nieuw" ? { status: "new" } : { status: { not: "new" } },
      include: {
        customer: { select: { name: true, company: { select: { name: true } } } },
        website: { select: { domain: true } },
      },
      orderBy: { receivedAt: "desc" },
      take: 100,
    }),
    prisma.inboundMail.groupBy({ by: ["status"], _count: { _all: true } }),
    mailboxStatus(),
  ]);
  const count = (s: string) =>
    counts
      .filter((c) => (s === "new" ? c.status === "new" : c.status !== "new"))
      .reduce((n, c) => n + c._count._all, 0);
  const tabs = [
    { key: "nieuw", label: "Te doen", count: count("new"), href: "/admin/binnengekomen" },
    { key: "afgehandeld", label: "Archief", count: count("other"), href: "/admin/binnengekomen?tab=afgehandeld" },
  ];

  return (
    <div className="max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl text-ink sm:text-3xl">Binnengekomen</h1>
          <p className="mt-1 text-sm text-inkSoft">
            {mailbox.configured
              ? `Bestellingen die per mail binnenkwamen op ${mailbox.user}. Elke paar minuten opgehaald.`
              : "Nog geen mailbox gekoppeld."}
          </p>
        </div>
        {mailbox.configured && <FetchNowButton />}
      </div>

      {!mailbox.configured && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Koppel eerst de mailbox bij{" "}
          <Link href="/admin/settings?tab=koppelingen" className="font-semibold underline">
            Instellingen → Koppelingen
          </Link>
          .
        </div>
      )}

      <nav className="mt-4 flex gap-2" aria-label="Filter">
        {tabs.map((t) => {
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              href={t.href}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "border-[var(--btn-pay-bg)] bg-[var(--pay-soft)] font-semibold text-[var(--btn-pay-bg)]"
                  : "border-line bg-surface text-ink/80 hover:bg-gray-50"
              }`}
            >
              {t.label}
              <span className={`tabular-nums ${active ? "" : "text-inkSoft"}`}>{t.count}</span>
            </Link>
          );
        })}
      </nav>

      <InboundList
        archive={tab === "afgehandeld"}
        empty={tab === "nieuw" ? "Geen nieuwe mails om te controleren." : "Het archief is leeg."}
        rows={mails.map((m) => {
          const status = mailStatus(m);
          return {
            id: m.id,
            who: m.customer ? (m.customer.company?.name ?? m.customer.name) : (m.fromName ?? m.fromEmail),
            time: mailTime(m.receivedAt),
            requestLabel: m.requestLabel,
            subject: m.subject.replace(/ · aanvraag \d+\/\d+$/, ""),
            domain: m.website?.domain ?? null,
            delivered: delivered(m),
            statusLabel: status.label,
            statusStyle: status.style,
            isNew: m.status === "new",
          };
        })}
      />
    </div>
  );
}
