import type { CSSProperties } from "react";

export type ButtonColors = { pay: string; primary: string; primaryFilled: boolean };

export const DEFAULT_BUTTON_COLORS: ButtonColors = { pay: "#0d9488", primary: "#2563eb", primaryFilled: true };

export const BUTTON_COLOR_PRESETS: { name: string; colors: ButtonColors }[] = [
  { name: "Blauw", colors: { pay: "#2563eb", primary: "#2563eb", primaryFilled: false } },
  { name: "Donkergrijs + blauw", colors: { pay: "#2563eb", primary: "#374151", primaryFilled: true } },
  { name: "Blauw + paars", colors: { pay: "#7c3aed", primary: "#2563eb", primaryFilled: false } },
  { name: "Blauw + turquoise", colors: { pay: "#0d9488", primary: "#2563eb", primaryFilled: true } },
  { name: "Navy + rood", colors: { pay: "#e11d48", primary: "#1e3a8a", primaryFilled: true } },
];

export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

// White text on a dark button, near-black on a light one — so whatever
// colour admin picks, the label stays readable.
export function textColorFor(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.35 ? "#1a1a1a" : "#ffffff";
}

// A light tint of a colour, for backgrounds behind it: `amount` of white
// mixed in ("#2563eb" → a pale blue).
export function softColor(hex: string, amount = 0.9): string {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16);
    return Math.round(c + (255 - c) * amount)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

// CSS variables set once on <body>; the .btn-primary/.btn-pay classes read them.
export function buttonColorVars(colors: ButtonColors): CSSProperties {
  const pay = isHexColor(colors.pay) ? colors.pay : DEFAULT_BUTTON_COLORS.pay;
  const primary = isHexColor(colors.primary) ? colors.primary : DEFAULT_BUTTON_COLORS.primary;
  return {
    "--btn-pay-bg": pay,
    "--btn-pay-fg": textColorFor(pay),
    "--btn-primary-bg": colors.primaryFilled ? primary : "#ffffff",
    "--btn-primary-fg": colors.primaryFilled ? textColorFor(primary) : primary,
    "--btn-primary-border": primary,
    // The primary colour itself (whatever the button style) and a tint of it,
    // for things that should match the buttons, like notices.
    "--primary-color": primary,
    "--primary-soft": softColor(primary),
  } as CSSProperties;
}
