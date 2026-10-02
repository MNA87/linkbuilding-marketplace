import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { mailboxStatus } from "@/lib/mailbox";
import { FetchNowButton } from "./MailButtons";
import { delivered, mailStatus, mailTime } from "./mailStatus";

export const metadata: Metadata = { title: "Binnengekomen" };

const COLUMNS = "md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_130px_130px_140px_32px]";

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
  const count = (s: string) => counts.filter((c) => (s === "new" ? c.status === "new" : c.status !== "new")).reduce((n, c) => n + c._count._all, 0);
  const tabs = [
    { key: "nieuw", label: "Te doen", count: count("new"), href: "/admin/binnengekomen" },
    { key: "afgehandeld", label: "Afgehandeld", count: count("other"), href: "/admin/binnengekomen?tab=afgehandeld" },
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

      <div className="mt-4 overflow-hidden rounded-xl border border-line bg-surface">
        {mails.length > 0 && (
          <div className={`hidden md:grid ${COLUMNS} gap-x-4 bg-gray-50 px-5 py-2.5 text-xs font-medium text-inkSoft`}>
            <span>Van</span>
            <span>Onderwerp</span>
            <span>Website</span>
            <span>Aangeleverd</span>
            <span>Status</span>
            <span />
          </div>
        )}
        {mails.map((m) => {
          const status = mailStatus(m);
          const who = m.customer ? (m.customer.company?.name ?? m.customer.name) : (m.fromName ?? m.fromEmail);
          return (
            <div
              key={m.id}
              className={`group relative grid grid-cols-1 gap-x-4 gap-y-1 border-t border-line/70 px-4 py-3.5 first:border-t-0 hover:bg-gray-50/70 sm:px-5 md:items-center ${COLUMNS} ${
                m.status === "new" ? "bg-[#fffcf2]" : ""
              }`}
            >
              <Link href={`/admin/binnengekomen/${m.id}`} className="absolute inset-0" aria-label={`Mail ${m.subject} bekijken`} />
              <div className="min-w-0">
                <div className="truncate text-ink">{who}</div>
                <div className="truncate text-xs text-inkSoft">{mailTime(m.receivedAt)}</div>
              </div>
              <span className="truncate text-sm text-ink/80">{m.subject}</span>
              <span className="text-sm text-ink/80">
                <span className="text-inkSoft md:hidden">Website: </span>
                {m.website?.domain ?? "—"}
              </span>
              <span className="text-sm text-ink/80">{delivered(m)}</span>
              <span>
                <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${status.style}`}>
                  {status.label}
                </span>
              </span>
              <span className="hidden h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-inkSoft transition-colors group-hover:bg-[var(--btn-pay-bg)] group-hover:text-white md:flex">
                <ChevronRight size={16} />
              </span>
            </div>
          );
        })}
        {mails.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-inkSoft">
            {tab === "nieuw" ? "Geen nieuwe mails om te controleren." : "Nog niets afgehandeld."}
          </div>
        )}
      </div>
    </div>
  );
}
