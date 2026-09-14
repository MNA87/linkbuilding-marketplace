import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import RoleShell, { NavItem } from "@/components/RoleShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") redirect("/login");

  const [pendingWebsites, pendingRefunds] = await Promise.all([
    prisma.website.count({ where: { status: "SUBMITTED" } }),
    prisma.order.count({ where: { status: "REFUND_REQUESTED" } }),
  ]);

  const nav: NavItem[] = [
    { href: "/admin", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/admin/websites", label: "Websites", icon: "Globe2", badge: pendingWebsites },
    { href: "/admin/customers", label: "Klanten", icon: "Users" },
    { href: "/admin/publishers", label: "Publishers", icon: "Building2" },
    { href: "/admin/pricing", label: "Prijzen & marges", icon: "SlidersHorizontal" },
    { href: "/admin/orders", label: "Orders", icon: "ListOrdered" },
    { href: "/admin/refunds", label: "Restituties", icon: "Undo2", badge: pendingRefunds },
    { href: "/admin/finance", label: "Betalingen", icon: "Landmark" },
  ];

  return (
    <RoleShell navItems={nav} roleLabel="Admin" userName={session.user.name ?? "Platformbeheer"}>
      {children}
    </RoleShell>
  );
}
