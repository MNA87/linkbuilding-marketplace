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
    title: "Backlink Exchange",
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
