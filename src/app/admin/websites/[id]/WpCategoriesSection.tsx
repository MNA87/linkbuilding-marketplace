type WpCategory = { id: string; wpTermId: number; name: string };

function CategoryList({ categories }: { categories: WpCategory[] }) {
  return (
    <div className="space-y-1">
      {categories.map((c) => (
        <div key={c.id} className="border border-line rounded-md px-3 py-1.5 text-sm text-ink">
          {c.name} <span className="text-inkSoft">(ID: {c.wpTermId})</span>
        </div>
      ))}
    </div>
  );
}

// Read-only: these come from the site itself (its WP Sync plugin reports
// them on every sync cycle via /api/wp-sync/categories) — never typed in
// here, so there's nothing for an admin to add or edit. Blog categories
// (WordPress' built-in "Categorieën") and homepage-link rubrieken (a
// separate custom taxonomy the plugin registers) are two different lists —
// a startpagina rubriek like "SEO" has nothing to do with how the blog
// itself is organized, so they're shown, and offered at order time, apart.
export default function WpCategoriesSection({
  blogCategories,
  linkCategories,
  syncedAt,
  syncActive,
}: {
  blogCategories: WpCategory[];
  linkCategories: WpCategory[];
  syncedAt: Date | null;
  syncActive: boolean;
}) {
  return (
    <div className="bg-surface border border-line rounded-lg p-4 mb-6">
      <h2 className="font-medium text-ink mb-1">WordPress-categorieën</h2>
      <p className="text-sm text-inkSoft mb-3">
        Deze lijsten komen automatisch van de site zelf (via WP Sync), dus hier is niets handmatig in te stellen.
      </p>

      {!syncActive && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          WP Sync staat niet aan voor deze site — installeer de sync-plugin (zie WordPress-koppeling hierboven) om
          categorieën op te halen.
        </p>
      )}

      {syncActive && (
        <>
          <h3 className="text-xs font-medium text-inkSoft uppercase tracking-wide mb-1">
            Blogartikelen (WordPress-categorieën)
          </h3>
          {blogCategories.length > 0 ? (
            <CategoryList categories={blogCategories} />
          ) : (
            <p className="text-sm text-inkSoft mb-2">Nog geen categorieën ontvangen.</p>
          )}

          <h3 className="text-xs font-medium text-inkSoft uppercase tracking-wide mt-4 mb-1">
            Homepage-links (startpagina-rubrieken)
          </h3>
          {linkCategories.length > 0 ? (
            <CategoryList categories={linkCategories} />
          ) : (
            <p className="text-sm text-inkSoft mb-2">
              Nog geen rubrieken ontvangen — die maak je in WordPress aan onder de nieuwe taxonomie die de plugin
              toevoegt (los van de gewone Categorieën).
            </p>
          )}

          <p className="text-xs text-inkSoft mt-3">
            {syncedAt
              ? `Laatst bijgewerkt: ${syncedAt.toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam" })}`
              : "Nog niet gesynchroniseerd sinds de plugin is geïnstalleerd."}
          </p>
        </>
      )}
    </div>
  );
}
