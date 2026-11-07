import type { Metadata } from "next";
import { PUBLIC_SITE } from "@/lib/publicSite";
import { Eyebrow, Section } from "@/components/public/ui";

export const metadata: Metadata = { title: "Privacybeleid" };

export default function PrivacyPage() {
  return (
    <Section>
      <div className="mx-auto max-w-[720px]">
        <Eyebrow>Juridisch</Eyebrow>
        <h1 className="mt-3 font-display text-[36px] leading-[1.06] tracking-[-.035em] text-pub-ink sm:text-[44px]">
          Privacybeleid
        </h1>
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          TODO: dit is een placeholder. De daadwerkelijke, juridisch correcte privacyverklaring moet nog door de
          platformeigenaar (eventueel met een jurist) worden opgesteld en hier worden geplaatst, vóórdat het platform
          live gaat met echte gebruikers.
        </div>
        <p className="mt-6 text-[16px] leading-relaxed text-[#374151]">
          Hier komt te staan welke persoonsgegevens Publito verwerkt, met welk doel, op welke rechtsgrond, hoe lang ze
          worden bewaard, en welke rechten gebruikers hebben (inzage, correctie, verwijdering — zie ook de
          accountverwijdering onder Account-instellingen). Vragen over privacy: {PUBLIC_SITE.contactEmail}.
        </p>
      </div>
    </Section>
  );
}
