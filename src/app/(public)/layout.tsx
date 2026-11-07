import type { Metadata } from "next";
import localFont from "next/font/local";
import PublicNav from "@/components/public/PublicNav";
import PublicFooter from "@/components/public/PublicFooter";

// De publieke site (publito.nl): homepage, prijzen, uitbesteden, over ons,
// contact. Eigen nav/footer en eigen typografie; de ingelogde app houdt
// haar eigen shell en huisstijl.

// Inter, zelf gehost (Latin-subset) — geen externe font-aanvraag, past
// binnen de CSP (font-src 'self').
const inter = localFont({
  src: [
    { path: "./fonts/inter-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/inter-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/inter-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/inter-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
});

const display = localFont({
  src: "./fonts/inter-display-800.woff2",
  weight: "800",
  style: "normal",
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Publito — Linkbuilding marktplaats", template: "%s · Publito" },
  description:
    "Backlinks op gecontroleerde sites met echte bezoekers. Direct bij de bron, transparante cijfers en het artikel inbegrepen.",
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`pub-site ${inter.variable} ${display.variable} bg-white font-inter text-pub-body antialiased`}>
      <PublicNav />
      {/* De laatste sectie krijgt extra ruimte onderin: daar valt de band van de footer overheen. */}
      <main className="[&>section:last-child]:pb-28 sm:[&>section:last-child]:pb-32">{children}</main>
      <PublicFooter />
    </div>
  );
}
