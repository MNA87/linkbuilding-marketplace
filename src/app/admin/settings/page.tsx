import { prisma } from "@/lib/prisma";
import MasterDataSection from "./MasterDataSection";
import NoindexToggle from "./NoindexToggle";
import { getNoindexEnabled } from "@/lib/siteSettings";

export default async function AdminSettingsPage() {
  const [categories, countries, languages, noindexEnabled] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { websites: true } } } }),
    prisma.country.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { websites: true } } } }),
    prisma.language.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { websites: true } } } }),
    getNoindexEnabled(),
  ]);

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="font-serif text-2xl text-ink mb-1">Algemeen</h1>
        <p className="text-sm text-inkSoft">Zichtbaarheid van de site.</p>
      </div>

      <NoindexToggle initialNoindexEnabled={noindexEnabled} />

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
