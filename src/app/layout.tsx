import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import CookieBanner from "@/components/CookieBanner";
import { getNoindexEnabled } from "@/lib/siteSettings";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body className="font-sans">
        <Providers>{children}</Providers>
        <CookieBanner />
      </body>
    </html>
  );
}
