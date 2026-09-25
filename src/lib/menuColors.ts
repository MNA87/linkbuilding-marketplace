import { isHexColor } from "@/lib/buttonColors";

// Heading colours of the customer menu's three groups, set in
// Admin → Instellingen → Menukleuren.
export type MenuColors = { buy: string; manage: string; admin: string };

export const DEFAULT_MENU_COLORS: MenuColors = {
  buy: "#2563eb",
  manage: "#7c3aed",
  admin: "#059669",
};

export const MENU_GROUPS: { key: keyof MenuColors; label: string }[] = [
  { key: "buy", label: "Links kopen" },
  { key: "manage", label: "Beheren" },
  { key: "admin", label: "Administratie" },
];

// A stored colour that somehow isn't valid falls back to the default, so
// the menu never ends up with an unreadable heading.
export function safeMenuColors(colors: MenuColors): MenuColors {
  return {
    buy: isHexColor(colors.buy) ? colors.buy : DEFAULT_MENU_COLORS.buy,
    manage: isHexColor(colors.manage)
      ? colors.manage
      : DEFAULT_MENU_COLORS.manage,
    admin: isHexColor(colors.admin) ? colors.admin : DEFAULT_MENU_COLORS.admin,
  };
}
