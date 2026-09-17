type WpCategory = { id: string; wpTermId: number; name: string };

// Read-only: these come from the site itself (its WP Sync plugin reports
// them on every sync cycle via /api/wp-sync/categories) — never typed in
// here, so there's nothing for an admin to add or edit.
export default function WpCategoriesSection({
  categories,
  syncedAt,
  syncActive,
}: {
  categories: WpCategory[];
  syncedAt: Date | null;
  syncActive: boolean;
}) {
  return (
    <div className="bg-surface border border-line rounded-lg p-4 mb-6">
      <h2 className="font-medium text-ink mb-1">WordPress-categorieën</h2>
      <p className="text-sm text-inkSoft mb-3">
        De categorieën die een klant kan kiezen bij het bestellen — het artikel wordt in de gekozen categorie
        gepubliceerd. Deze lijst komt automatisch van de site zelf (via WP Sync), dus hier is niets handmatig in
        te stellen.
      </p>

      {!syncActive && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          WP Sync staat niet aan voor deze site — installeer de sync-plugin (zie WordPress-koppeling hierboven) om
          categorieën op te halen.
        </p>
      )}

      {syncActive && categories.length > 0 && (
        <div className="space-y-1 mb-2">
          {categories.map((c) => (
            <div key={c.id} className="border border-line rounded-md px-3 py-1.5 text-sm text-ink">
              {c.name} <span className="text-inkSoft">(ID: {c.wpTermId})</span>
            </div>
          ))}
        </div>
      )}
      {syncActive && categories.length === 0 && (
        <p className="text-sm text-inkSoft mb-2">
          Nog geen categorieën ontvangen — de site meldt deze bij de eerste synchronisatie (automatisch binnen 5
          minuten, of direct via &quot;Nu synchroniseren&quot; in het WordPress-dashboard van de site).
        </p>
      )}
      {syncActive && (
        <p className="text-xs text-inkSoft">
          {syncedAt
            ? `Laatst bijgewerkt: ${syncedAt.toLocaleString("nl-NL")}`
            : "Nog niet gesynchroniseerd sinds de plugin is geïnstalleerd."}
        </p>
      )}
    </div>
  );
}
