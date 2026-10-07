import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import RoleShell, { NavItem } from "@/components/RoleShell";
import { unansweredCount } from "@/lib/orderMessageCounts";
import { adminActionCount } from "@/lib/adminOrders";
import { launchPercent } from "@/lib/launch";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") redirect("/login");

  const [pendingWebsites, pendingRefunds, unanswered, ordersToDo, launchItems, newMails, vatToCheck, me] =
    await Promise.all([
      prisma.website.count({ where: { status: "SUBMITTED" } }),
      prisma.order.count({ where: { status: "REFUND_REQUESTED" } }),
      unansweredCount(),
      adminActionCount(),
      prisma.launchItem.findMany({ where: { list: "livegang" }, select: { status: true } }),
      prisma.inboundMail.count({ where: { status: "new" } }),
      // Ter info: a valid foreign VAT number with another name in VIES.
      prisma.company.count({ where: { type: "CUSTOMER", vatStatus: "mismatch" } }),
      prisma.user.findUnique({ where: { id: session.user.id }, select: { totpEnabledAt: true } }),
    ]);

  const nav: NavItem[] = [
    { href: "/admin", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/admin/livegang", label: "Planning", icon: "Flag", note: `${launchPercent(launchItems)}%` },
    { href: "/admin/websites", label: "Websites", icon: "Globe2", badge: pendingWebsites },
    { href: "/admin/customers", label: "Klanten", icon: "Users", badge: vatToCheck },
    // Publishers (/admin/publishers) stays out of the menu until external
    // publishers join; for now all sites are Nugevonden's own.
    // Orders that came in by mail, still to be checked.
    { href: "/admin/binnengekomen", label: "Binnengekomen", icon: "Inbox", badge: newMails },
    { href: "/admin/orders", label: "Orders", icon: "ListOrdered", badge: ordersToDo },
    { href: "/admin/messages", label: "Berichten", icon: "MessageSquare", badge: unanswered },
    // Customers can't ask for a cancellation any more (the admin cancels on
    // the order page); shown only while an older request is still open.
    ...(pendingRefunds > 0
      ? [{ href: "/admin/refunds", label: "Restituties", icon: "Undo2", badge: pendingRefunds } as NavItem]
      : []),
    { href: "/admin/invoices", label: "Facturen", icon: "Receipt" },
    { href: "/admin/finance", label: "Betalingen", icon: "Landmark" },
    { href: "/admin/reconcile", label: "Betalingen controleren", icon: "RefreshCw" },
    { href: "/admin/emails", label: "E-mails", icon: "Mail" },
    { href: "/admin/settings", label: "Instellingen", icon: "SlidersHorizontal" },
  ];

  return (
    <RoleShell
      navItems={nav}
      roleLabel="Admin"
      userName={session.user.name ?? "Platformbeheer"}
      accountHref="/admin/account"
    >
      {/* Required for the admin: until it's on, a reminder on every page. */}
      {!me?.totpEnabledAt && (
        <Link
          href="/admin/account"
          className="mb-5 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100"
        >
          <ShieldAlert size={16} className="shrink-0" />
          <span>
            <b>Zet tweestapsverificatie aan.</b> Verplicht voor een admin-account: inloggen met je wachtwoord én een
            code van je telefoon.
          </span>
          <span className="ml-auto shrink-0 font-semibold">Aanzetten →</span>
        </Link>
      )}
      {children}
    </RoleShell>
  );
}
