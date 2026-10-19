import type { ComponentProps } from "react";
import { cookies } from "next/headers";
import { MENU_COOKIE } from "@/lib/menuCookie";
import { getLogoDataUrl } from "@/lib/siteSettings";
import RoleShellClient from "./RoleShellClient";

export type { NavItem } from "./RoleShellClient";

// Reads whether the menu was folded in (a cookie, set by the "Inklappen"
// button), so the page comes from the server already in that state —
// no menu jumping open and shut on load. Folded in until someone opens it,
// so the tables get the full width. Also loads the eigen logo (Admin →
// Instellingen → Kleuren), so every shell shows it without each layout passing it.
export default async function RoleShell(
  props: Omit<ComponentProps<typeof RoleShellClient>, "initialCollapsed" | "logoUrl">
) {
  const [cookieStore, logoUrl] = await Promise.all([cookies(), getLogoDataUrl()]);
  const collapsed = cookieStore.get(MENU_COOKIE)?.value !== "open";
  return <RoleShellClient {...props} initialCollapsed={collapsed} logoUrl={logoUrl} />;
}
