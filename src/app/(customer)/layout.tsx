import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import RoleShell, { NavItem } from "@/components/RoleShell";
import { expiringSoonWhere } from "@/lib/customerOverview";
import { getMenuColors } from "@/lib/siteSettings";
import { unreadForCustomerWhere } from "@/lib/orderMessages";
import { awaitingContentWhere } from "@/lib/awaitingContent";
import { reachableNow, whatsappDigits, whatsappUrl } from "@/lib/contact";

// Middleware blokkeert de verkeerde rol al, maar een server-side check hier
// is een bewuste tweede verdedigingslinie — een layout die zelf ook
// controleert is robuuster tegen toekomstige wijzigingen in de middleware.
export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer") redirect("/login");

  const [cartCount, expiringCount, unreadMessages, settings, colors, toFillCount] = await Promise.all([
    prisma.orderItem.count({ where: { order: { customerId: session.user.id, status: "NEW" } } }),
    prisma.orderItem.count({ where: expiringSoonWhere(session.user.id) }),
    prisma.orderMessage.count({ where: unreadForCustomerWhere(session.user.id) }),
    prisma.siteSettings.findUnique({ where: { id: 1 }, select: { sellerEmail: true, whatsappNumber: true } }),
    getMenuColors(),
    prisma.orderItem.count({ where: awaitingContentWhere(session.user.id) }),
  ]);

  const nav: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
    // Iedereen gebruikt dezelfde flow (blog + homepage via tabs): een bureau
    // bestelt op rekening, een reguliere klant rekent direct af. De oude losse
    // marketplace blijft als fallback bestaan op /marketplace, maar staat niet
    // meer in het menu.
    {
      section: "Links kopen",
      sectionColor: colors.buy,
      href: "/dashboard/marketplace",
      label: "Marketplace",
      icon: "FileText",
    },
    {
      section: "Beheren",
      sectionColor: colors.manage,
      href: "/dashboard/orders",
      label: "Mijn orders",
      icon: "Package",
      badge: expiringCount + unreadMessages + toFillCount,
    },
    {
      section: "Administratie",
      sectionColor: colors.admin,
      // De cart IS de bestelling-in-wording in de flow, dus de badge brengt je
      // terug in Marketplace om verder te gaan waar je gebleven was.
      href: "/dashboard/marketplace",
      label: "Winkelmandje",
      icon: "ShoppingCart",
      badge: cartCount,
      badgeTopOnly: true,
    },
    {
      section: "Administratie",
      sectionColor: colors.admin,
      href: "/dashboard/invoices",
      label: "Facturen",
      icon: "Receipt",
    },
    {
      section: "Administratie",
      sectionColor: colors.admin,
      href: "/dashboard/account",
      label: "Account",
      icon: "User",
    },
  ];

  const whatsappNumber = whatsappDigits(settings?.whatsappNumber ?? "");

  return (
    <RoleShell
      navItems={nav}
      userName={session.user.companyName ?? session.user.name ?? ""}
      accountHref="/dashboard/account"
      helpEmail={settings?.sellerEmail || undefined}
      whatsapp={whatsappNumber ? { url: whatsappUrl(whatsappNumber), reachable: reachableNow() } : undefined}
    >
      {children}
    </RoleShell>
  );
}
