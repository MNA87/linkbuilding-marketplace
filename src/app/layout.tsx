import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Backlink Exchange",
  description: "Linkbuilding marketplace",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body className="font-sans">{children}</body>
    </html>
  );
}
