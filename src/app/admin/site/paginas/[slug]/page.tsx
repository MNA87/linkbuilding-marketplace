import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CMS_PAGES, isCmsSlug } from "@/lib/cms/pages";
import { getEditorState } from "@/lib/cms/content";
import SiteEditor, { type EditorDef } from "../../SiteEditor";

export const metadata: Metadata = { title: "Pagina bewerken" };

export default async function EditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isCmsSlug(slug)) notFound();
  const def = CMS_PAGES[slug];
  const state = await getEditorState(slug);
  if (!state) notFound();
  const editorDef: EditorDef = {
    slug,
    title: def.title,
    path: def.path,
    isPage: def.isPage,
    canUnpublish: def.canUnpublish,
    blocks: Object.fromEntries(Object.entries(def.blocks).map(([id, b]) => [id, { label: b.label, fields: b.fields }])),
  };
  return (
    <SiteEditor
      def={editorDef}
      initial={{ full: state.full, status: state.status, hasDraft: state.hasDraft, updatedAt: state.updatedAt }}
      backHref="/admin/site/paginas"
      backLabel="Pagina's"
    />
  );
}
