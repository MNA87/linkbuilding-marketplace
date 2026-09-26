"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LogOut,
  Menu,
  X,
  ChevronDown,
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
  Mail,
  FileText,
  House,
  Package,
  MessageSquare,
  CircleHelp,
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
  Mail,
  FileText,
  House,
  Package,
  MessageSquare,
};

export type NavItem = {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  badge?: number;
  // A small grey number instead of the red badge — e.g. how many sites
  // there are to choose from, not something that needs attention.
  count?: number;
  // Group heading shown above the first item of each group, optionally in
  // its own colour (a #rrggbb code) so the groups are easy to tell apart.
  section?: string;
  sectionColor?: string;
};

// "/marketplace?type=BLOG_POST" is active on /marketplace with that type (or
// no type, for the default one); other items match on their path.
function isActive(href: string, pathname: string | null, searchParams: URLSearchParams | null): boolean {
  const [path, query] = href.split("?");
  if (!query) return pathname === path || Boolean(pathname?.startsWith(path + "/"));
  if (pathname !== path) return false;
  const wanted = new URLSearchParams(query);
  return Array.from(wanted.entries()).every(
    ([key, value]) => (searchParams?.get(key) ?? (key === "type" ? "BLOG_POST" : null)) === value
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function RoleShell({
  children,
  navItems,
  roleLabel,
  userName,
  accountHref,
  helpEmail,
}: {
  children: React.ReactNode;
  navItems: NavItem[];
  // A line under the name in the menu (Admin, Supplier); none for customers.
  roleLabel?: string;
  userName: string;
  accountHref?: string;
  // Shows a "Hulp nodig?" box at the bottom of the menu.
  helpEmail?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const cartItem = navItems.find((item) => item.icon === "ShoppingCart");
  // Only the most specific match lights up — "/dashboard" also matches on
  // "/dashboard/orders", but there it's "Mijn orders" that's active.
  const activeHref = navItems
    .filter((item) => isActive(item.href, pathname, searchParams))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const nav = (
    <>
      {/* The same height as the top bar, so their lines run on. */}
      <div className="h-16 shrink-0 px-5 border-b border-line flex items-center justify-between">
        <div>
          <div className="font-serif text-lg text-ink">Nugevonden</div>
          {roleLabel && <div className="text-xs text-inkSoft mt-0.5">{roleLabel}</div>}
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
        {navItems.map((item, i) => {
          const active = item.href === activeHref;
          const Icon = ICONS[item.icon];
          const heading = item.section && item.section !== navItems[i - 1]?.section ? item.section : null;
          return (
            <div key={item.href}>
              {heading && (
                <div
                  className={`flex items-center gap-2 px-3 pt-5 pb-1.5 text-xs font-semibold uppercase tracking-wider ${
                    item.sectionColor ? "" : "text-ink/70"
                  }`}
                  style={item.sectionColor ? { color: item.sectionColor } : undefined}
                >
                  {item.sectionColor && (
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.sectionColor }} />
                  )}
                  {heading}
                </div>
              )}
              <Link
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  active ? "bg-gray-100 text-ink font-semibold" : "text-ink/80 hover:bg-gray-50 hover:text-ink"
                }`}
              >
                <Icon size={16} className={active ? "text-ink" : "text-gray-400"} />
                <span className="flex-1">{item.label}</span>
                {!!item.badge && (
                  <span className="bg-red-600 text-white text-[10px] font-medium rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {item.badge}
                  </span>
                )}
                {item.count !== undefined && !item.badge && (
                  <span className="text-xs text-inkSoft tabular-nums">{item.count}</span>
                )}
              </Link>
            </div>
          );
        })}
      </nav>
      {helpEmail && (
        <a
          href={`mailto:${helpEmail}`}
          className="mx-3 mb-2 flex items-center gap-3 px-3 py-2 rounded-md text-sm text-inkSoft hover:bg-brandSoft/60 hover:text-ink"
        >
          <CircleHelp size={16} />
          <span>
            Hulp nodig? <span className="text-brand">Mail ons</span>
          </span>
        </a>
      )}
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
        <div className="font-serif text-base text-ink">Nugevonden</div>
        <div className="flex items-center gap-4">
          {cartItem && (
            <Link href={cartItem.href} className="relative text-ink" aria-label="Winkelmandje">
              <ShoppingCart size={22} />
              {!!cartItem.badge && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[10px] font-medium rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1">
                  {cartItem.badge}
                </span>
              )}
            </Link>
          )}
          <button onClick={() => setMobileOpen(true)} className="text-ink" aria-label="Menu openen">
            <Menu size={22} />
          </button>
        </div>
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

      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop top bar */}
        <div className="hidden md:flex h-16 shrink-0 items-center justify-end gap-5 px-6 bg-surface border-b border-line">
          {cartItem && (
            <Link href={cartItem.href} className="relative flex items-center text-ink hover:text-brand" aria-label="Winkelmandje">
              <ShoppingCart size={24} />
              {!!cartItem.badge && (
                <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-medium rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1">
                  {cartItem.badge}
                </span>
              )}
            </Link>
          )}

          <div className="relative">
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              className="flex items-center gap-2 text-sm text-ink hover:text-brand"
            >
              <span className="w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center text-xs font-medium shrink-0">
                {getInitials(userName)}
              </span>
              <span className="whitespace-nowrap">{userName}</span>
              <ChevronDown size={16} className={userMenuOpen ? "rotate-180" : ""} />
            </button>

            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-56 bg-surface border border-line rounded-md shadow-lg z-50 py-1">
                  {accountHref && (
                    <Link
                      href={accountHref}
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-inkSoft hover:bg-brandSoft hover:text-ink"
                    >
                      <User size={16} />
                      Mijn gegevens
                    </Link>
                  )}
                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-inkSoft hover:bg-brandSoft hover:text-ink"
                  >
                    <LogOut size={16} />
                    Uitloggen
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <main className="flex-1 p-4 sm:p-6 md:p-8 min-w-0">{children}</main>
      </div>
    </div>
  );
}
