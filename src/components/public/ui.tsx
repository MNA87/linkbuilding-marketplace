import Link from "next/link";
import type { ReactNode } from "react";

// Kleine bouwstenen voor de publieke site, zodat elke pagina dezelfde
// knoppen, koppen en secties gebruikt.

const BTN =
  "inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-semibold transition whitespace-nowrap";

export function ButtonLink({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "outline" | "soft" | "light";
  className?: string;
}) {
  const look =
    variant === "primary"
      ? "bg-pub-green text-white hover:bg-pub-greenDark"
      : variant === "outline"
        ? "border border-[#d6dadf] bg-white text-pub-ink hover:border-pub-green"
        : variant === "soft"
          ? "bg-pub-mint text-pub-greenDark border border-[#cfe3d8] hover:bg-[#dcebe3]"
          : "bg-white text-pub-ink hover:bg-pub-mist";
  return (
    <Link href={href} className={`${BTN} ${look} ${className}`}>
      {children}
    </Link>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="text-xs font-bold uppercase tracking-[.08em] text-pub-greenDark">{children}</div>;
}

export function SectionTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={`mt-3 font-display text-[32px] leading-[1.06] tracking-[-.035em] text-pub-ink sm:text-[40px] ${className}`}>
      {children}
    </h2>
  );
}

export function Section({
  children,
  tone = "white",
  className = "",
  id,
}: {
  children: ReactNode;
  tone?: "white" | "mist";
  className?: string;
  id?: string;
}) {
  const bg = tone === "mist" ? "bg-pub-mist border-y border-pub-mistLine" : "bg-white";
  return (
    <section id={id} className={`${bg} py-16 sm:py-20 ${className}`}>
      <div className="mx-auto max-w-[1160px] px-5 sm:px-7">{children}</div>
    </section>
  );
}

export function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((t) => (
        <span
          key={t}
          className="rounded-full border border-[#e0e3e1] bg-pub-mist px-3 py-1.5 text-xs font-bold uppercase tracking-[.04em] text-pub-ink"
        >
          {t}
        </span>
      ))}
    </div>
  );
}

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="mx-auto mt-10 grid max-w-[800px] gap-2.5">
      {items.map((it, i) => (
        <details
          key={it.q}
          open={i === 0}
          className="group rounded-xl border border-pub-line bg-white px-5 py-4 open:shadow-sm"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15.5px] font-semibold text-pub-ink [&::-webkit-details-marker]:hidden">
            {it.q}
            <span className="text-lg font-extrabold text-pub-green group-open:hidden">+</span>
            <span className="hidden text-lg font-extrabold text-pub-green group-open:inline">–</span>
          </summary>
          <p className="mt-2 text-[14.5px] leading-relaxed text-[#4b5563]">{it.a}</p>
        </details>
      ))}
    </div>
  );
}

export function PriceCards({ priceBlogFrom, priceHomepageFrom }: { priceBlogFrom: string; priceHomepageFrom: string }) {
  const cards = [
    {
      badge: "Meest gekozen",
      title: "Bloglink",
      price: priceBlogFrom,
      unit: "vanaf · permanent",
      points: ["Redactioneel artikel met jouw link", "Tekst + afbeelding inbegrepen", "Blijft permanent online"],
      cta: "Bekijk bloglinks",
    },
    {
      badge: "Sterkste signaal",
      title: "Homepagelink",
      price: priceHomepageFrom,
      unit: "vanaf · per jaar",
      points: ["Jouw link direct op de voorpagina", "Op sterke, relevante domeinen", "Jaarlijks verlengbaar"],
      cta: "Bekijk homepagelinks",
    },
  ];
  return (
    <div className="mx-auto mt-10 grid max-w-[860px] gap-5 md:grid-cols-2">
      {cards.map((c, i) => (
        <div
          key={c.title}
          className={`rounded-2xl bg-white p-7 text-pub-ink ${
            i === 0 ? "border-[1.5px] border-pub-ink shadow-[0_30px_60px_-36px_rgba(43,42,38,.35)]" : "border border-pub-line"
          }`}
        >
          <span className="inline-block rounded-full bg-pub-stone px-3 py-1 text-[11px] font-bold uppercase tracking-[.06em] text-pub-ink">
            {c.badge}
          </span>
          <h3 className="mt-4 text-[22px] font-bold">{c.title}</h3>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-[44px] leading-none tracking-[-.03em]">€ {c.price}</span>
            <span className="text-sm text-pub-soft">{c.unit}</span>
          </div>
          <ul className="mt-5 grid gap-2 text-[14.5px] text-[#374151]">
            {c.points.map((p) => (
              <li key={p} className="flex gap-2">
                <span className="text-pub-green">✓</span>
                {p}
              </li>
            ))}
          </ul>
          <ButtonLink href="/register" variant={i === 0 ? "primary" : "soft"} className="mt-7 w-full">
            {c.cta}
          </ButtonLink>
        </div>
      ))}
      <p className="text-center text-[13px] text-pub-soft md:col-span-2">Alle prijzen zijn exclusief btw.</p>
    </div>
  );
}
