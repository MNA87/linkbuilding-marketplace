import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import RoleShell, { NavItem } from "@/components/RoleShell";
import { unansweredCount } from "@/lib/orderMessageCounts";
import { adminActionCount } from "@/lib/adminOrders";
import { launchPercent } from "@/lib/launch";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") redirect("/login");

  const [pendingWebsites, pendingRefunds, unanswered, ordersToDo, launchItems] = await Promise.all([
    prisma.website.count({ where: { status: "SUBMITTED" } }),
    prisma.order.count({ where: { status: "REFUND_REQUESTED" } }),
    unansweredCount(),
    adminActionCount(),
    prisma.launchItem.findMany({ where: { list: "livegang" }, select: { status: true } }),
  ]);

  const nav: NavItem[] = [
    { href: "/admin", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/admin/livegang", label: "Planning", icon: "Flag", note: `${launchPercent(launchItems)}%` },
    { href: "/admin/websites", label: "Websites", icon: "Globe2", badge: pendingWebsites },
    { href: "/admin/customers", label: "Klanten", icon: "Users" },
    // Publishers (/admin/publishers) stays out of the menu until external
    // publishers join; for now all sites are Nugevonden's own.
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
    <RoleShell navItems={nav} roleLabel="Admin" userName={session.user.name ?? "Platformbeheer"}>
      {children}
    </RoleShell>
  );
}
