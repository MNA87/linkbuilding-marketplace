import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import RoleShell, { NavItem } from "@/components/RoleShell";

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/admin/websites", label: "Websites", icon: "Globe2" },
  { href: "/admin/customers", label: "Klanten", icon: "Users" },
  { href: "/admin/publishers", label: "Publishers", icon: "Building2" },
  { href: "/admin/pricing", label: "Prijzen & marges", icon: "SlidersHorizontal" },
  { href: "/admin/orders", label: "Orders", icon: "ListOrdered" },
  { href: "/admin/finance", label: "Betalingen", icon: "Landmark" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") redirect("/login");

  return (
    <RoleShell navItems={NAV} roleLabel="Admin" userName={session.user.name ?? "Platformbeheer"}>
      {children}
    </RoleShell>
  );
}
