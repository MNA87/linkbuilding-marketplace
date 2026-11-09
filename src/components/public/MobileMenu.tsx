"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { ButtonLink } from "./ui";

// Hamburgermenu voor de publieke site op mobiel. Opent een paneel onder de
// balk met de links en de twee knoppen; sluit bij navigatie en met Escape.
export default function MobileMenu({
  links,
  loginHref,
  registerHref,
}: {
  links: { href: string; label: string }[];
  loginHref: string;
  registerHref: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobiel-menu"
        aria-label={open ? "Menu sluiten" : "Menu openen"}
        className="grid h-11 w-11 place-items-center rounded-xl border border-[#d6dadf] bg-white text-pub-ink"
      >
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>

      {open && (
        <div id="mobiel-menu" className="fixed inset-x-0 top-[74px] bottom-0 z-40 flex flex-col bg-white">
          <nav className="flex-1 overflow-y-auto px-5 py-3" aria-label="Menu">
            {links.map((l) => (
              <Link
                key={l.href + l.label}
                href={l.href}
                className={`block border-b border-pub-line py-4 text-[18px] font-semibold ${pathname === l.href ? "text-pub-green" : "text-pub-ink"}`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="grid gap-3 border-t border-pub-line bg-pub-mist px-5 py-5">
            <ButtonLink href={registerHref} className="w-full">
              Naar platform
            </ButtonLink>
            <ButtonLink href={loginHref} variant="outline" className="w-full">
              Inloggen
            </ButtonLink>
          </div>
        </div>
      )}
    </div>
  );
}
