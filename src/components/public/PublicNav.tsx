import Image from "next/image";
import Link from "next/link";
import logo from "@/app/(public)/_assets/publito-logo.webp";
import { PUBLIC_LINKS } from "@/lib/publicSite";
import { ButtonLink } from "./ui";
import MobileMenu from "./MobileMenu";

const LINKS = [
  { href: PUBLIC_LINKS.register, label: "Marktplaats" },
  { href: PUBLIC_LINKS.outsource, label: "Uitbesteden" },
  { href: PUBLIC_LINKS.prices, label: "Prijzen" },
  { href: PUBLIC_LINKS.blog, label: "Blog" },
  { href: PUBLIC_LINKS.about, label: "Over ons" },
  { href: PUBLIC_LINKS.contact, label: "Contact" },
];

export default function PublicNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-pub-line bg-white">
      <div className="mx-auto flex h-[74px] max-w-[1160px] items-center gap-6 px-5 sm:px-7">
        <Link href="/" className="-ml-2 block shrink-0" aria-label="Publito — naar de homepage">
          {/* Het logobestand heeft veel witruimte; iets groter zetten houdt het wordmark leesbaar. */}
          <Image src={logo} alt="Publito" priority unoptimized className="h-[56px] w-auto mix-blend-multiply" />
        </Link>
        <nav className="hidden items-center gap-5 text-[14.5px] font-medium text-[#374151] lg:flex" aria-label="Hoofdmenu">
          {LINKS.map((l) => (
            <Link key={l.href + l.label} href={l.href} className="hover:text-pub-ink">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2.5">
          <ButtonLink href={PUBLIC_LINKS.login} variant="outline" className="hidden !px-4 !py-2.5 text-sm lg:inline-flex">
            Inloggen
          </ButtonLink>
          <ButtonLink href={PUBLIC_LINKS.register} className="hidden !px-4 !py-2.5 text-sm lg:inline-flex">
            Naar platform
          </ButtonLink>
          <MobileMenu links={LINKS} loginHref={PUBLIC_LINKS.login} registerHref={PUBLIC_LINKS.register} />
        </div>
      </div>
    </header>
  );
}
