import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isUnanswered, latestPerConversation, messageTime } from "@/lib/orderMessages";

export const metadata: Metadata = { title: "Berichten" };

// Every conversation with a customer (one per order), newest first;
// "Onbeantwoord" are the ones whose last message is the customer's.
export default async function AdminMessagesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const all = (await searchParams).tab === "alle";

  const messages = await prisma.orderMessage.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      order: {
        select: {
          orderNumber: true,
          customer: { select: { name: true, company: { select: { name: true } } } },
          items: {
            where: { renewsOrderItemId: null },
            orderBy: { id: "asc" },
            select: { id: true, websiteProduct: { select: { website: { select: { domain: true } } } } },
          },
        },
      },
    },
  });
  const conversations = latestPerConversation(messages);
  const unanswered = conversations.filter(isUnanswered);
  const shown = all ? conversations : unanswered;

  const tabs = [
    {
      href: "/admin/messages",
      label: "Onbeantwoord",
      count: unanswered.length,
      active: !all,
    },
    {
      href: "/admin/messages?tab=alle",
      label: "Alle",
      count: conversations.length,
      active: all,
    },
  ];

  return (
    <div className="max-w-5xl">
      <h1 className="font-serif text-2xl text-ink">Berichten</h1>
      <p className="text-sm text-inkSoft mt-1">
        Vragen en reacties van klanten over hun orders. De nieuwste staan bovenaan.
      </p>

      <nav className="mt-5 flex gap-1 border-b border-line">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm ${
              t.active ? "border-ink font-semibold text-ink" : "border-transparent text-inkSoft hover:text-ink"
            }`}
          >
            {t.label}
            <span
              className={`rounded-full px-1.5 text-[11px] leading-[18px] ${
                t.label === "Onbeantwoord" && t.count > 0 ? "bg-red-100 text-red-700" : "bg-gray-100 text-inkSoft"
              }`}
            >
              {t.count}
            </span>
          </Link>
        ))}
      </nav>

      {shown.map((m) => {
        const waiting = isUnanswered(m);
        const customer = m.order.customer.company?.name ?? m.order.customer.name;
        const items = m.order.items;
        const domains =
          items.length > 1
            ? `${items[0].websiteProduct.website.domain} + ${items.length - 1} andere`
            : (items[0]?.websiteProduct.website.domain ?? "Verlenging");
        return (
          <Link
            key={m.orderId}
            href={items[0] ? `/admin/orders/${items[0].id}#berichten` : "/admin/orders"}
            className={`mt-2 grid grid-cols-[10px_minmax(0,1fr)_auto] md:grid-cols-[10px_200px_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-xl border bg-surface px-4 py-3.5 transition-shadow hover:shadow-sm ${
              waiting ? "border-blue-300" : "border-line"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${waiting ? "bg-brand" : ""}`} />
            <div className="min-w-0">
              <div className="truncate text-sm text-ink">{customer}</div>
              <div className="truncate text-xs text-inkSoft">
                Order #{m.order.orderNumber} · {domains}
              </div>
            </div>
            <div
              className={`col-start-2 md:col-start-auto min-w-0 truncate text-sm ${waiting ? "font-semibold text-ink" : "text-ink/80"}`}
            >
              {m.fromAdmin ? "Jij: " : ""}
              {m.body}
            </div>
            <div className="row-start-1 col-start-3 md:row-start-auto md:col-start-auto whitespace-nowrap text-xs text-inkSoft">
              {messageTime(m.createdAt)}
            </div>
          </Link>
        );
      })}

      {shown.length === 0 && (
        <div className="mt-4 rounded-xl border border-line bg-surface px-5 py-10 text-center text-sm text-inkSoft">
          {all ? "Nog geen berichten." : "Alles is beantwoord."}
        </div>
      )}
    </div>
  );
}
