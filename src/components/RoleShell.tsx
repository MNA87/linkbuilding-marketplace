import type { ComponentProps } from "react";
import { cookies } from "next/headers";
import { MENU_COOKIE } from "@/lib/menuCookie";
import RoleShellClient from "./RoleShellClient";

export type { NavItem } from "./RoleShellClient";

// Reads whether the menu was folded in (a cookie, set by the "Inklappen"
// button), so the page comes from the server already in that state —
// no menu jumping open and shut on load. Folded in until someone opens it,
// so the tables get the full width.
export default async function RoleShell(props: Omit<ComponentProps<typeof RoleShellClient>, "initialCollapsed">) {
  const collapsed = (await cookies()).get(MENU_COOKIE)?.value !== "open";
  return <RoleShellClient {...props} initialCollapsed={collapsed} />;
}
