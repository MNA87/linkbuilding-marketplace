import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import RoleShell, { NavItem } from "@/components/RoleShell";
import { expiringSoonWhere, offerSummary } from "@/lib/customerOverview";
import { getMenuColors } from "@/lib/siteSettings";

// Middleware blokkeert de verkeerde rol al, maar een server-side check hier
// is een bewuste tweede verdedigingslinie — een layout die zelf ook
// controleert is robuuster tegen toekomstige wijzigingen in de middleware.
export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer") redirect("/login");

  const [cartCount, expiringCount, offer, settings, colors] = await Promise.all([
    prisma.orderItem.count({ where: { order: { customerId: session.user.id, status: "NEW" } } }),
    prisma.orderItem.count({ where: expiringSoonWhere(session.user.id) }),
    offerSummary(),
    prisma.siteSettings.findUnique({ where: { id: 1 }, select: { sellerEmail: true } }),
    getMenuColors(),
  ]);

  const nav: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
    { section: "Links kopen", sectionColor: colors.buy, href: "/marketplace?type=BLOG_POST", label: "Blog links", icon: "FileText", count: offer.BLOG_POST.sites },
    { section: "Links kopen", sectionColor: colors.buy, href: "/marketplace?type=HOMEPAGE_LINK", label: "Homepage links", icon: "House", count: offer.HOMEPAGE_LINK.sites },
    { section: "Beheren", sectionColor: colors.manage, href: "/dashboard/orders", label: "Mijn orders", icon: "Package", badge: expiringCount },
    { section: "Beheren", sectionColor: colors.manage, href: "/dashboard/projects", label: "Projecten", icon: "FolderKanban" },
    { section: "Administratie", sectionColor: colors.admin, href: "/dashboard/cart", label: "Winkelmandje", icon: "ShoppingCart", badge: cartCount },
    { section: "Administratie", sectionColor: colors.admin, href: "/dashboard/invoices", label: "Facturen", icon: "Receipt" },
    { section: "Administratie", sectionColor: colors.admin, href: "/dashboard/account", label: "Account", icon: "User" },
  ];

  return (
    <RoleShell
      navItems={nav}
      roleLabel="Klantportaal"
      userName={session.user.companyName ?? session.user.name ?? ""}
      accountHref="/dashboard/account"
      helpEmail={settings?.sellerEmail || undefined}
    >
      {children}
    </RoleShell>
  );
}
