"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { MENU_COOKIE } from "@/lib/menuCookie";
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
  Flag,
  Inbox,
  PanelLeftClose,
  PanelLeftOpen,
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
  Flag,
  Inbox,
};

export type NavItem = {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  badge?: number;
  // The badge only on the cart icon in the top bar, not in the menu.
  badgeTopOnly?: boolean;
  // Short grey text at the end instead, e.g. "40%" for the livegang.
  note?: string;
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

// The name next to an icon in the folded-in menu, shown at once on hover.
function Tip({ text }: { text: string }) {
  return (
    <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-x-1 -translate-y-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition duration-150 group-hover:translate-x-0 group-hover:opacity-100">
      {/* A small arrow pointing at the icon. */}
      <span className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 rounded-[1px] bg-gray-900" />
      {text}
    </span>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// The WhatsApp logo (simple-icons), in the colour of the text around it.
function WhatsAppIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className="shrink-0 text-emerald-600"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

export default function RoleShell({
  children,
  navItems,
  roleLabel,
  userName,
  accountHref,
  helpEmail,
  whatsapp,
  initialCollapsed = false,
}: {
  children: React.ReactNode;
  navItems: NavItem[];
  // A line under the name in the menu (Admin, Supplier); none for customers.
  roleLabel?: string;
  userName: string;
  accountHref?: string;
  // Shows a "Hulp nodig?" box at the bottom of the menu.
  helpEmail?: string;
  // The WhatsApp button at the top (customers, once a number is set).
  whatsapp?: { url: string; reachable: boolean };
  // The menu folded in to icons only (desktop), as the user left it.
  initialCollapsed?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${MENU_COOKIE}=${next ? "dicht" : "open"}; path=/; max-age=31536000; samesite=lax`;
  };
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const cartItem = navItems.find((item) => item.icon === "ShoppingCart");
  // Only the most specific match lights up — "/dashboard" also matches on
  // "/dashboard/orders", but there it's "Mijn orders" that's active.
  const activeHref = navItems
    .filter((item) => isActive(item.href, pathname, searchParams))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  // The menu; "small" folds it in to icons only, with the name on hover.
  const nav = (small: boolean) => (
    <>
      {/* The same height as the top bar, so their lines run on. */}
      <div
        className={`h-16 shrink-0 border-b border-line flex items-center ${small ? "justify-center px-2" : "justify-between px-5"}`}
      >
        {small ? (
          <div className="font-serif text-xl text-ink" title="Nugevonden">
            N
          </div>
        ) : (
          <div>
            <div className="font-serif text-lg text-ink">Nugevonden</div>
            {roleLabel && <div className="text-xs text-inkSoft mt-0.5">{roleLabel}</div>}
          </div>
        )}
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden text-inkSoft hover:text-ink"
          aria-label="Menu sluiten"
        >
          <X size={20} />
        </button>
      </div>
      <nav className={`flex-1 py-4 space-y-1 ${small ? "px-2" : "px-3 overflow-y-auto"}`}>
        {navItems.map((item, i) => {
          const active = item.href === activeHref;
          const Icon = ICONS[item.icon];
          const heading = item.section && item.section !== navItems[i - 1]?.section ? item.section : null;
          const badge = item.badgeTopOnly ? 0 : item.badge;
          return (
            <div key={item.href}>
              {heading && !small && (
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
              {/* Folded in: a short line in the group's colour instead of its name. */}
              {heading && small && (
                <div
                  className="mx-auto mt-4 mb-2 h-[3px] w-4 rounded-full opacity-70"
                  style={{ backgroundColor: item.sectionColor ?? "#e5e7eb" }}
                />
              )}
              <Link
                href={item.href}
                onClick={() => setMobileOpen(false)}
                aria-label={small ? item.label : undefined}
                className={`group relative flex items-center rounded-md text-sm transition-colors ${
                  small ? "justify-center h-10" : "gap-3 px-3 py-2"
                } ${active ? "bg-gray-100 text-ink font-semibold" : "text-ink/80 hover:bg-gray-50 hover:text-ink"}`}
              >
                <Icon size={small ? 18 : 16} className={active ? "text-ink" : "text-gray-400"} />
                {small ? <Tip text={item.label} /> : <span className="flex-1">{item.label}</span>}
                {!!badge &&
                  (small ? (
                    <span className="absolute top-1.5 right-2.5 h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-white" />
                  ) : (
                    <span className="bg-red-600 text-white text-[10px] font-medium rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {badge}
                    </span>
                  ))}
                {item.note && !badge && !small && (
                  <span className="text-xs font-semibold text-[var(--btn-pay-bg)] tabular-nums">{item.note}</span>
                )}
              </Link>
            </div>
          );
        })}
      </nav>
      <div className={`py-4 border-t border-line ${small ? "px-2" : "px-3"}`}>
        {/* Phone only: there's no account menu at the top right there, so
            help and logging out stay in the menu. */}
        <div className="md:hidden">
          {helpEmail && (
            <a
              href={`mailto:${helpEmail}`}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-inkSoft hover:bg-brandSoft/60 hover:text-ink"
            >
              <CircleHelp size={16} />
              <span>
                Hulp nodig? <span className="text-brand">Mail ons</span>
              </span>
            </a>
          )}
          <div className="px-3 py-1.5 text-xs text-inkSoft truncate">{userName}</div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-inkSoft hover:bg-brandSoft hover:text-ink transition-colors"
          >
            <LogOut size={16} />
            Uitloggen
          </button>
        </div>
        {/* Desktop only: fold the menu in to icons, or out again. */}
        <button
          onClick={toggleCollapsed}
          aria-label={small ? "Menu uitklappen" : "Menu inklappen"}
          className={`group relative hidden md:flex w-full items-center rounded-md text-sm text-inkSoft hover:bg-brandSoft hover:text-ink transition-colors ${
            small ? "justify-center h-10" : "gap-3 px-3 py-2"
          }`}
        >
          {small ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={16} />}
          {small ? <Tip text="Uitklappen" /> : "Inklappen"}
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
          {whatsapp && (
            <a
              href={whatsapp.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
            >
              <WhatsAppIcon />
              WhatsApp
            </a>
          )}
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
          <aside className="relative w-72 max-w-[85vw] bg-surface flex flex-col h-full">{nav(false)}</aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex sticky top-0 h-screen shrink-0 bg-surface border-r border-line flex-col transition-[width] duration-200 ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        {nav(collapsed)}
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop top bar */}
        <div className="hidden md:flex h-16 shrink-0 items-center justify-end gap-5 px-6 bg-surface border-b border-line">
          {/* WhatsApp, once a number is set (Admin → Instellingen). */}
          {whatsapp && (
            <a
              href={whatsapp.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
            >
              <WhatsAppIcon />
              {whatsapp.reachable ? "WhatsApp · Nu bereikbaar" : "WhatsApp"}
            </a>
          )}
          {cartItem && (
            <Link
              href={cartItem.href}
              className="relative flex items-center text-ink hover:text-brand"
              aria-label="Winkelmandje"
            >
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
              <span className="w-8 h-8 rounded-full bg-gray-100 text-ink flex items-center justify-center text-xs font-medium shrink-0">
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
                  {helpEmail && (
                    <a
                      href={`mailto:${helpEmail}`}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-inkSoft hover:bg-brandSoft hover:text-ink"
                    >
                      <CircleHelp size={16} />
                      Hulp nodig? Mail ons
                    </a>
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
