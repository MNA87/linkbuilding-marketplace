import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import MasterDataSection from "./MasterDataSection";
import NoindexToggle from "./NoindexToggle";
import AutoPublishToggle from "./AutoPublishToggle";
import ButtonColorsSettings from "./ButtonColorsSettings";
import WritingPriceSetting from "./WritingPriceSetting";
import DetailsForm from "@/components/DetailsForm";
import { setSellerDetailsAction } from "./actions";
import { getNoindexEnabled, getAutoPublishEnabled, getButtonColors } from "@/lib/siteSettings";

export const metadata: Metadata = { title: "Instellingen" };

export default async function AdminSettingsPage() {
  const [categories, countries, languages, noindexEnabled, autoPublishEnabled, buttonColors, settings] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { websites: true } } } }),
    prisma.country.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { websites: true } } } }),
    prisma.language.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { websites: true } } } }),
    getNoindexEnabled(),
    getAutoPublishEnabled(),
    getButtonColors(),
    prisma.siteSettings.findUnique({ where: { id: 1 } }),
  ]);
  const sellerComplete = Boolean(settings?.sellerName && settings.sellerKvk && settings.sellerVatNumber);

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="font-serif text-2xl text-ink mb-1">Algemeen</h1>
        <p className="text-sm text-inkSoft">Zichtbaarheid van de site en van betaalde orders.</p>
      </div>

      <NoindexToggle initialNoindexEnabled={noindexEnabled} />
      <AutoPublishToggle initialAutoPublishEnabled={autoPublishEnabled} />
      <WritingPriceSetting initialPrice={Number(settings?.writingPrice ?? 25)} />
      <ButtonColorsSettings initialColors={buttonColors} />

      <div id="bedrijfsgegevens" className="bg-surface border border-line rounded-lg p-4 space-y-3">
        <div>
          <h2 className="font-medium text-ink">Bedrijfsgegevens op facturen</h2>
          <p className="text-sm text-inkSoft">
            Deze gegevens komen als verkoper op elke nieuwe factuur. Een factuur die al is gemaakt, verandert niet mee.
          </p>
        </div>
        {!sellerComplete && (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            Nog niet ingevuld — zonder bedrijfsnaam, KvK- en BTW-nummer zijn facturen niet volledig.
          </div>
        )}
        <DetailsForm
          action={setSellerDetailsAction}
          initialValues={{
            sellerName: settings?.sellerName ?? "",
            sellerAddress: settings?.sellerAddress ?? "",
            sellerPostcode: settings?.sellerPostcode ?? "",
            sellerCity: settings?.sellerCity ?? "",
            sellerKvk: settings?.sellerKvk ?? "",
            sellerVatNumber: settings?.sellerVatNumber ?? "",
            sellerIban: settings?.sellerIban ?? "",
            sellerEmail: settings?.sellerEmail ?? "",
          }}
          fields={[
            { name: "sellerName", label: "Bedrijfsnaam", wide: true },
            { name: "sellerAddress", label: "Adres", placeholder: "Straat en huisnummer", wide: true },
            { name: "sellerPostcode", label: "Postcode", placeholder: "1234 AB" },
            { name: "sellerCity", label: "Plaats" },
            { name: "sellerKvk", label: "KvK-nummer", placeholder: "12345678" },
            { name: "sellerVatNumber", label: "BTW-nummer", placeholder: "NL123456789B01" },
            { name: "sellerIban", label: "IBAN", optional: true },
            { name: "sellerEmail", label: "E-mailadres", optional: true },
          ]}
        />
      </div>

      <div>
        <h1 className="font-serif text-2xl text-ink mb-1">Stamdata</h1>
        <p className="text-sm text-inkSoft">Categorieën, landen en talen die suppliers kunnen kiezen bij hun websites.</p>
      </div>

      <MasterDataSection
        title="Categorieën"
        kind="category"
        items={categories.map((c) => ({ id: c.id, label: c.name, inUse: c._count.websites > 0 }))}
      />
      <MasterDataSection
        title="Landen"
        kind="country"
        withCode
        items={countries.map((c) => ({ id: c.id, label: `${c.name} (${c.code})`, inUse: c._count.websites > 0 }))}
      />
      <MasterDataSection
        title="Talen"
        kind="language"
        withCode
        items={languages.map((l) => ({ id: l.id, label: `${l.name} (${l.code})`, inUse: l._count.websites > 0 }))}
      />
    </div>
  );
}
