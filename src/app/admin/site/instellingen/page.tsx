import type { Metadata } from "next";
import { settingsPage } from "@/lib/cms/pages";
import { getEditorState } from "@/lib/cms/content";
import SiteEditor, { type EditorDef } from "../SiteEditor";

export const metadata: Metadata = { title: "Site-instellingen" };

// Cijfers, contactgegevens en prijskaarten van publito.nl. Dezelfde editor als
// de pagina's, zonder voorbeeld: deze waarden komen op meerdere pagina's terug.
export default async function SiteSettingsPage() {
  const state = await getEditorState(settingsPage.slug);
  const def: EditorDef = {
    slug: settingsPage.slug,
    title: settingsPage.title,
    path: "",
    isPage: false,
    canUnpublish: false,
    blocks: Object.fromEntries(Object.entries(settingsPage.blocks).map(([id, b]) => [id, { label: b.label, fields: b.fields }])),
  };
  return (
    <SiteEditor
      def={def}
      initial={{ full: state!.full, status: "published", hasDraft: state!.hasDraft, updatedAt: state!.updatedAt }}
      backHref="/admin/site/paginas"
      backLabel="Pagina's"
    />
  );
}
