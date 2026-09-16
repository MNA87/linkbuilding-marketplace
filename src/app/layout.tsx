import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import CookieBanner from "@/components/CookieBanner";

export const metadata: Metadata = {
  title: "Backlink Exchange",
  description: "Linkbuilding marketplace",
  robots: { index: false, follow: false },
};

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
