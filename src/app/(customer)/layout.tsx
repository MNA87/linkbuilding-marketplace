import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import RoleShell, { NavItem } from "@/components/RoleShell";
import { LayoutDashboard, Store, ListOrdered, Link2, FolderKanban, Receipt, User } from "lucide-react";

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/marketplace", label: "Marketplace", icon: Store },
  { href: "/dashboard/orders", label: "Mijn orders", icon: ListOrdered },
  { href: "/dashboard/links", label: "Mijn links", icon: Link2 },
  { href: "/dashboard/projects", label: "Projecten", icon: FolderKanban },
  { href: "/dashboard/invoices", label: "Facturen", icon: Receipt },
  { href: "/dashboard/account", label: "Account", icon: User },
];

// Middleware blokkeert de verkeerde rol al, maar een server-side check hier
// is een bewuste tweede verdedigingslinie — een layout die zelf ook
// controleert is robuuster tegen toekomstige wijzigingen in de middleware.
export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer") redirect("/login");

  return (
    <RoleShell navItems={NAV} roleLabel="Customer" userName={session.user.companyName ?? session.user.name ?? ""}>
      {children}
    </RoleShell>
  );
}
