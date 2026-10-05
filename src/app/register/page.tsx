import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { CreditCard, PenLine, Search } from "lucide-react";
import { authOptions } from "@/lib/auth";
import RegisterForm from "./RegisterForm";

export const metadata: Metadata = { title: "Account aanmaken" };

const BENEFITS = [
  { icon: Search, title: "Kies zelf je websites", text: "Zie vooraf DR, verkeer en prijs van elke site." },
  { icon: PenLine, title: "Wij schrijven het artikel", text: "Of lever je eigen tekst aan, ook na betaling." },
  { icon: CreditCard, title: "Je betaalt pas bij bestellen", text: "Een account is gratis en verplicht je tot niets." },
];

export default async function RegisterPage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/");

  return (
    <div className="grid min-h-screen bg-surface lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Why sign up: next to the form on a wide screen, under it on a phone. */}
      <aside className="relative order-2 overflow-hidden bg-gradient-to-br from-[var(--btn-pay-bg)] to-[#0b5f58] px-6 py-10 text-white sm:px-10 lg:order-1 lg:flex lg:flex-col lg:gap-10 lg:px-14 lg:py-12">
        <div aria-hidden className="absolute -right-36 -top-32 h-[420px] w-[420px] rounded-full bg-white/[0.07]" />
        <div aria-hidden className="absolute -bottom-20 -left-24 h-[300px] w-[300px] rounded-full bg-white/[0.05]" />
        <Link href="/" className="relative hidden font-serif text-[22px] lg:block">
          Nugevonden
        </Link>
        <div className="relative flex flex-col gap-7 lg:my-auto">
          <h2 className="max-w-[420px] font-serif text-3xl leading-tight tracking-tight lg:text-[38px]">
            Sterke links op Nederlandse websites.
          </h2>
          <ul className="flex flex-col gap-3">
            {BENEFITS.map(({ icon: Icon, title, text }) => (
              <li
                key={title}
                className="flex items-center gap-3.5 rounded-2xl border border-white/15 bg-white/10 px-4 py-3.5"
              >
                <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-white text-[var(--btn-pay-bg)]">
                  <Icon size={18} />
                </span>
                <span>
                  <span className="block text-[15px] font-semibold">{title}</span>
                  <span className="block text-[13.5px] text-white/85">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative mt-8 text-[13px] text-white/75 lg:mt-0">
          Vragen? Mail ons op{" "}
          <a href="mailto:info@nugevonden.nl" className="underline-offset-2 hover:underline">
            info@nugevonden.nl
          </a>
        </p>
      </aside>

      <main className="order-1 flex items-center justify-center px-4 py-10 sm:px-8 lg:order-2 lg:py-12">
        <div className="w-full max-w-[480px]">
          <Link href="/" className="mb-8 block font-serif text-[22px] text-ink lg:hidden">
            Nugevonden
          </Link>
          <RegisterForm />
        </div>
      </main>
    </div>
  );
}
