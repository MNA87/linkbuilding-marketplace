"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export default function RoleShell({
  children,
  navItems,
  roleLabel,
  userName,
}: {
  children: React.ReactNode;
  navItems: NavItem[];
  roleLabel: string;
  userName: string;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex bg-brandSoft/30">
      <aside className="w-64 shrink-0 bg-surface border-r border-line flex flex-col">
        <div className="px-5 py-5 border-b border-line">
          <div className="font-serif text-lg text-ink">Backlink Exchange</div>
          <div className="text-xs text-inkSoft mt-0.5">{roleLabel}</div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-brand text-white"
                    : "text-inkSoft hover:bg-brandSoft hover:text-ink"
                }`}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-4 border-t border-line">
          <div className="px-3 py-1.5 text-xs text-inkSoft truncate">{userName}</div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-inkSoft hover:bg-brandSoft hover:text-ink transition-colors"
          >
            <LogOut size={16} />
            Uitloggen
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
