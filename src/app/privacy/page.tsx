import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacybeleid" };

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-16">
      <h1 className="font-serif text-2xl text-ink mb-4">Privacybeleid</h1>
      <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 mb-6">
        TODO: dit is een placeholder. De daadwerkelijke, juridisch correcte privacyverklaring moet nog
        door de platformeigenaar (eventueel met een jurist) worden opgesteld en hier worden geplaatst,
        vóórdat het platform live gaat met echte gebruikers.
      </div>
      <p className="text-sm text-inkSoft">
        Hier komt te staan welke persoonsgegevens Nugevonden verwerkt, met welk doel, op welke
        rechtsgrond, hoe lang ze worden bewaard, en welke rechten gebruikers hebben (inzage, correctie,
        verwijdering — zie ook de accountverwijdering onder Account-instellingen).
      </p>
    </div>
  );
}
