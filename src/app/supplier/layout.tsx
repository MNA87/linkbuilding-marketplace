import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import RoleShell, { NavItem } from "@/components/RoleShell";

const NAV: NavItem[] = [
  { href: "/supplier", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/supplier/websites", label: "Mijn websites", icon: "Globe2" },
  { href: "/supplier/orders", label: "Orders", icon: "ListOrdered" },
  { href: "/supplier/payouts", label: "Uitbetalingen", icon: "Wallet" },
  { href: "/supplier/account", label: "Account", icon: "User" },
];

export default async function SupplierLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "supplier") redirect("/login");

  return (
    <RoleShell
      navItems={NAV}
      roleLabel="Supplier"
      userName={session.user.companyName ?? session.user.name ?? ""}
      accountHref="/supplier/account"
    >
      {children}
    </RoleShell>
  );
}
