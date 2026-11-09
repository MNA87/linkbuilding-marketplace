import Image from "next/image";
import Link from "next/link";
import logo from "@/app/(public)/_assets/publito-logo.webp";
import { PUBLIC_LINKS } from "@/lib/publicSite";
import { getSiteSettings } from "@/lib/cms/content";
import { ButtonLink } from "./ui";

const COLS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Platform",
    links: [
      { href: PUBLIC_LINKS.register, label: "Marktplaats" },
      { href: PUBLIC_LINKS.prices, label: "Prijzen" },
      { href: PUBLIC_LINKS.outsource, label: "Uitbesteden" },
      { href: PUBLIC_LINKS.login, label: "Inloggen" },
    ],
  },
  {
    title: "Bedrijf",
    links: [
      { href: PUBLIC_LINKS.about, label: "Over ons" },
      { href: PUBLIC_LINKS.contact, label: "Contact" },
    ],
  },
  {
    title: "Juridisch",
    links: [
      { href: PUBLIC_LINKS.terms, label: "Voorwaarden" },
      { href: PUBLIC_LINKS.privacy, label: "Privacy" },
    ],
  },
];

// Zandkleurige footer met bovenaan een witte band die half over de laatste
// sectie van de pagina valt (de layout geeft die sectie extra ruimte onderin).
export default async function PublicFooter() {
  const { settings } = await getSiteSettings();
  const email = settings.contact.contactEmail;
  return (
    <footer className="border-t border-pub-zandLine bg-pub-zand pb-8 text-pub-ink">
      <div className="mx-auto max-w-[1160px] px-5 sm:px-7">
        <div className="relative -mt-16 flex flex-col gap-5 rounded-3xl border border-pub-zandLine border-l-8 border-l-pub-green bg-white px-6 py-7 shadow-[0_24px_48px_-30px_rgba(43,42,38,.35)] sm:flex-row sm:items-center sm:justify-between sm:px-10 sm:py-9">
          <p className="font-display text-[26px] leading-[1.1] tracking-[-.035em] text-pub-ink sm:text-[34px]">
            Bouw aan autoriteit <span className="text-pub-green">die blijft.</span>
          </p>
          <ButtonLink href={PUBLIC_LINKS.register} className="shrink-0 self-start sm:self-auto">
            Naar platform
          </ButtonLink>
        </div>

        <div className="mt-12 grid gap-10 sm:grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="-ml-2 inline-block" aria-label="Publito — naar de homepage">
              <Image src={logo} alt="Publito" unoptimized className="h-[48px] w-auto mix-blend-multiply" />
            </Link>
            <p className="mt-3 max-w-[30ch] text-[14.5px] leading-relaxed text-pub-zandInk">
              Backlinks op gecontroleerde sites met echte bezoekers. Direct bij de bron.
            </p>
            <a
              href={`mailto:${email}`}
              className="mt-3 inline-block text-[14.5px] font-semibold text-pub-ink hover:text-pub-green"
            >
              {email}
            </a>
          </div>
          {COLS.map((c) => (
            <div key={c.title}>
              <h4 className="text-[15px] font-bold text-pub-ink after:mt-2 after:block after:h-[3px] after:w-6 after:rounded-full after:bg-pub-green">
                {c.title}
              </h4>
              <ul className="mt-4 grid gap-2.5 text-[15px] text-[#3f3a31]">
                {c.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="hover:text-pub-green hover:underline">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap justify-between gap-2 border-t border-pub-zandLine pt-5 text-[13.5px] text-pub-zandInk">
          <span>© {new Date().getFullYear()} Publito</span>
          <span>{settings.contact.countries}</span>
        </div>
      </div>
    </footer>
  );
}
