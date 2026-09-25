import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import CookieBanner from "@/components/CookieBanner";
import DutchFormValidation from "@/components/DutchFormValidation";
import { getButtonColors, getNoindexEnabled } from "@/lib/siteSettings";
import { buttonColorVars, DEFAULT_BUTTON_COLORS } from "@/lib/buttonColors";

// Without this, Next.js tries to prerender pages (and their metadata) at
// build time, which would either bake the noindex flag in permanently or
// fail the build outright since the database isn't reachable at build time.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const noindexEnabled = await getNoindexEnabled();
  return {
    // Every page's own title (set via each page's `metadata`/`generateMetadata`)
    // fills in "%s", so browser tabs read e.g. "Dashboard · Nugevonden" instead
    // of the same generic title everywhere.
    title: { default: "Nugevonden", template: "%s · Nugevonden" },
    description: "Linkbuilding marketplace",
    robots: noindexEnabled ? { index: false, follow: false } : undefined,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // A settings hiccup must never take the whole site down over button colours.
  const buttonColors = await getButtonColors().catch(() => DEFAULT_BUTTON_COLORS);
  return (
    <html lang="nl">
      <body className="font-sans" style={buttonColorVars(buttonColors)}>
        <Providers>{children}</Providers>
        <CookieBanner />
        <DutchFormValidation />
      </body>
    </html>
  );
}
