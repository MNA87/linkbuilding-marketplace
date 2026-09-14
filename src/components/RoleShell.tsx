"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LogOut,
  Menu,
  X,
  LayoutDashboard,
  Store,
  ListOrdered,
  Link2,
  FolderKanban,
  Receipt,
  User,
  Globe2,
  Users,
  Building2,
  SlidersHorizontal,
  Landmark,
  Wallet,
  ShoppingCart,
  Undo2,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";

// Server layouts can't pass component/function references as props to this
// client component (Next.js can't serialize functions across the boundary),
// so nav items carry an icon *name* and get resolved to a component here.
const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Store,
  ListOrdered,
  Link2,
  FolderKanban,
  Receipt,
  User,
  Globe2,
  Users,
  Building2,
  SlidersHorizontal,
  Landmark,
  Wallet,
  ShoppingCart,
  Undo2,
  RefreshCw,
};

export type NavItem = {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  badge?: number;
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
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav = (
    <>
      <div className="px-5 py-5 border-b border-line flex items-center justify-between">
        <div>
          <div className="font-serif text-lg text-ink">Backlink Exchange</div>
          <div className="text-xs text-inkSoft mt-0.5">{roleLabel}</div>
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden text-inkSoft hover:text-ink"
          aria-label="Menu sluiten"
        >
          <X size={20} />
        </button>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + "/");
          const Icon = ICONS[item.icon];
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                active ? "bg-brand text-white" : "text-inkSoft hover:bg-brandSoft hover:text-ink"
              }`}
            >
              <Icon size={16} />
              <span className="flex-1">{item.label}</span>
              {!!item.badge && (
                <span className="bg-red-600 text-white text-[10px] font-medium rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {item.badge}
                </span>
              )}
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
    </>
  );

  return (
    <div className="min-h-screen md:flex bg-brandSoft/30">
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-surface border-b border-line sticky top-0 z-30">
        <div className="font-serif text-base text-ink">Backlink Exchange</div>
        <button onClick={() => setMobileOpen(true)} className="text-ink" aria-label="Menu openen">
          <Menu size={22} />
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 max-w-[85vw] bg-surface flex flex-col h-full">{nav}</aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 bg-surface border-r border-line flex-col">{nav}</aside>

      <main className="flex-1 p-4 sm:p-6 md:p-8 min-w-0">{children}</main>
    </div>
  );
}
