import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import RoleShell, { NavItem } from "@/components/RoleShell";
import { unansweredCount } from "@/lib/orderMessageCounts";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") redirect("/login");

  const [pendingWebsites, pendingRefunds, unanswered] = await Promise.all([
    prisma.website.count({ where: { status: "SUBMITTED" } }),
    prisma.order.count({ where: { status: "REFUND_REQUESTED" } }),
    unansweredCount(),
  ]);

  const nav: NavItem[] = [
    { href: "/admin", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/admin/websites", label: "Websites", icon: "Globe2", badge: pendingWebsites },
    { href: "/admin/customers", label: "Klanten", icon: "Users" },
    { href: "/admin/publishers", label: "Publishers", icon: "Building2" },
    { href: "/admin/orders", label: "Orders", icon: "ListOrdered" },
    { href: "/admin/messages", label: "Berichten", icon: "MessageSquare", badge: unanswered },
    { href: "/admin/refunds", label: "Restituties", icon: "Undo2", badge: pendingRefunds },
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
