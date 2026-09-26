import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import MasterDataSection from "./MasterDataSection";
import NoindexToggle from "./NoindexToggle";
import AutoPublishToggle from "./AutoPublishToggle";
import ButtonColorsSettings from "./ButtonColorsSettings";
import MenuColorsSettings from "./MenuColorsSettings";
import WritingPriceSetting from "./WritingPriceSetting";
import DetailsForm from "@/components/DetailsForm";
import { setSellerDetailsAction } from "./actions";
import { getNoindexEnabled, getAutoPublishEnabled, getButtonColors, getMenuColors } from "@/lib/siteSettings";

export const metadata: Metadata = { title: "Instellingen" };

// One section at a time, picked with the tabs at the top (?tab=).
const TABS = [
  { key: "algemeen", label: "Algemeen" },
  { key: "kleuren", label: "Kleuren" },
  { key: "bedrijfsgegevens", label: "Bedrijfsgegevens" },
  { key: "keuzelijsten", label: "Categorieën, landen en talen" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default async function AdminSettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const requested = (await searchParams).tab;
  const tab: TabKey = TABS.find((t) => t.key === requested)?.key ?? "algemeen";
  const [categories, countries, languages, noindexEnabled, autoPublishEnabled, buttonColors, menuColors, settings] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { websites: true } } } }),
    prisma.country.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { websites: true } } } }),
    prisma.language.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { websites: true } } } }),
    getNoindexEnabled(),
    getAutoPublishEnabled(),
    getButtonColors(),
    getMenuColors(),
    prisma.siteSettings.findUnique({ where: { id: 1 } }),
  ]);
  const sellerComplete = Boolean(settings?.sellerName && settings.sellerKvk && settings.sellerVatNumber);

  return (
    <div className="max-w-3xl">
      <h1 className="font-serif text-2xl text-ink">Instellingen</h1>

      <nav className="mt-4 flex flex-wrap gap-x-1 border-b border-line" aria-label="Onderdelen">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "algemeen" ? "/admin/settings" : `/admin/settings?tab=${t.key}`}
            className={`-mb-px border-b-2 px-3 py-2.5 text-sm ${
              t.key === tab ? "border-ink font-semibold text-ink" : "border-transparent text-inkSoft hover:text-ink"
            }`}
          >
            {t.label}
            {t.key === "bedrijfsgegevens" && !sellerComplete && (
              <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-amber-500 align-middle" title="Nog niet ingevuld" />
            )}
          </Link>
        ))}
      </nav>

      <div className="mt-6 space-y-6">
        {tab === "algemeen" && (
          <>
            <NoindexToggle initialNoindexEnabled={noindexEnabled} />
            <AutoPublishToggle initialAutoPublishEnabled={autoPublishEnabled} />
            <WritingPriceSetting initialPrice={Number(settings?.writingPrice ?? 25)} />
          </>
        )}

        {tab === "kleuren" && (
          <>
            <ButtonColorsSettings initialColors={buttonColors} />
            <MenuColorsSettings initialColors={menuColors} />
          </>
        )}

        {tab === "bedrijfsgegevens" && (
          <div className="bg-surface border border-line rounded-lg p-4 space-y-3">
            <div>
              <h2 className="font-medium text-ink">Bedrijfsgegevens op facturen</h2>
              <p className="text-sm text-inkSoft">
                Deze gegevens komen als verkoper op elke nieuwe factuur. Een factuur die al is gemaakt, verandert niet
                mee.
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
        )}

        {tab === "keuzelijsten" && (
          <>
            <p className="text-sm text-inkSoft">Wat suppliers kunnen kiezen bij hun websites.</p>
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
          </>
        )}
      </div>
    </div>
  );
}
