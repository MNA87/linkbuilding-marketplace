"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignRight,
  LinkIcon,
  Unlink,
  Image as ImageIcon,
  Table as TableIcon,
  Palette,
  Highlighter,
} from "lucide-react";

// Article images are inserted with a "data-key" attribute alongside src, so
// the WordPress publish step can find each one and re-upload it to the
// target site's own Media Library — see src/lib/wordpress.ts.
const ArticleImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      "data-key": {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-key"),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes["data-key"] ? { "data-key": attributes["data-key"] } : {},
      },
    };
  },
});

const TEXT_COLORS = [
  { label: "Zwart", value: "#1a1a1a" },
  { label: "Rood", value: "#dc2626" },
  { label: "Blauw", value: "#2563eb" },
  { label: "Groen", value: "#16a34a" },
];

const HIGHLIGHT_COLORS = [
  { label: "Geel", value: "#fef08a" },
  { label: "Groen", value: "#bbf7d0" },
  { label: "Roze", value: "#fbcfe8" },
];

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const [linkPromptOpen, setLinkPromptOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [highlightPickerOpen, setHighlightPickerOpen] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Link.configure({ openOnClick: false, autolink: false }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      ArticleImage,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "prose-editor focus:outline-none min-h-[160px] px-3 py-2 text-sm text-ink",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return null;

  function openLinkPrompt() {
    setColorPickerOpen(false);
    setHighlightPickerOpen(false);
    setLinkUrl(editor!.getAttributes("link").href ?? "");
    setLinkPromptOpen(true);
  }

  function applyLink(e: React.FormEvent) {
    e.preventDefault();
    if (linkUrl.trim()) {
      editor!.chain().focus().extendMarkRange("link").setLink({ href: linkUrl.trim() }).run();
    }
    setLinkPromptOpen(false);
    setLinkUrl("");
  }

  async function handleImageSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImageError(null);
    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload/article-image", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setImageError(data.error ?? "Uploaden van afbeelding is mislukt.");
        return;
      }
      editor!
        .chain()
        .focus()
        .insertContent({ type: "image", attrs: { src: data.url, "data-key": data.key, alt: "" } })
        .run();
    } catch {
      setImageError("Uploaden van afbeelding is mislukt.");
    } finally {
      setImageUploading(false);
    }
  }

  const barBtn = (active: boolean) =>
    `p-1.5 rounded-md transition-colors ${active ? "bg-brand text-white" : "text-inkSoft hover:bg-brandSoft hover:text-ink"}`;

  return (
    <div className="border border-line rounded-md focus-within:ring-2 focus-within:ring-brand overflow-hidden">
      <div className="flex items-center gap-1 border-b border-line bg-brandSoft/40 px-2 py-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={barBtn(editor.isActive("heading", { level: 1 }))}
          aria-label="Kop 1"
        >
          <Heading1 size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={barBtn(editor.isActive("heading", { level: 2 }))}
          aria-label="Kop 2"
        >
          <Heading2 size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={barBtn(editor.isActive("heading", { level: 3 }))}
          aria-label="Kop 3"
        >
          <Heading3 size={15} />
        </button>
        <div className="w-px h-4 bg-line mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={barBtn(editor.isActive("bold"))}
          aria-label="Vet"
        >
          <Bold size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={barBtn(editor.isActive("italic"))}
          aria-label="Cursief"
        >
          <Italic size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={barBtn(editor.isActive("underline"))}
          aria-label="Onderstrepen"
        >
          <UnderlineIcon size={15} />
        </button>
        <div className="w-px h-4 bg-line mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={barBtn(editor.isActive("bulletList"))}
          aria-label="Opsomming"
        >
          <List size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={barBtn(editor.isActive("orderedList"))}
          aria-label="Genummerde lijst"
        >
          <ListOrdered size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={barBtn(editor.isActive("blockquote"))}
          aria-label="Citaat"
        >
          <Quote size={15} />
        </button>
        <div className="w-px h-4 bg-line mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          className={barBtn(editor.isActive({ textAlign: "left" }))}
          aria-label="Links uitlijnen"
        >
          <AlignLeft size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          className={barBtn(editor.isActive({ textAlign: "center" }))}
          aria-label="Centreren"
        >
          <AlignCenter size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          className={barBtn(editor.isActive({ textAlign: "right" }))}
          aria-label="Rechts uitlijnen"
        >
          <AlignRight size={15} />
        </button>
        <div className="w-px h-4 bg-line mx-1" />
        <button
          type="button"
          onClick={() => {
            setHighlightPickerOpen(false);
            setColorPickerOpen((open) => !open);
          }}
          className={barBtn(colorPickerOpen)}
          aria-label="Tekstkleur"
        >
          <Palette size={15} />
        </button>
        <button
          type="button"
          onClick={() => {
            setColorPickerOpen(false);
            setHighlightPickerOpen((open) => !open);
          }}
          className={barBtn(highlightPickerOpen)}
          aria-label="Markeren"
        >
          <Highlighter size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          className={barBtn(false)}
          aria-label="Tabel invoegen"
        >
          <TableIcon size={15} />
        </button>
        <div className="w-px h-4 bg-line mx-1" />
        <button type="button" onClick={openLinkPrompt} className={barBtn(editor.isActive("link"))} aria-label="Link invoegen">
          <LinkIcon size={15} />
        </button>
        {editor.isActive("link") && (
          <button
            type="button"
            onClick={() => editor.chain().focus().unsetLink().run()}
            className={barBtn(false)}
            aria-label="Link verwijderen"
          >
            <Unlink size={15} />
          </button>
        )}
        <button
          type="button"
          disabled={imageUploading}
          onClick={() => imageInputRef.current?.click()}
          className={`${barBtn(false)} disabled:opacity-60`}
          aria-label="Afbeelding invoegen"
        >
          <ImageIcon size={15} />
        </button>
        <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={handleImageSelected} />
        {imageUploading && <span className="text-xs text-inkSoft">Uploaden...</span>}
      </div>

      {colorPickerOpen && (
        <div className="flex items-center gap-2 px-2 py-2 border-b border-line bg-surface">
          <span className="text-xs text-inkSoft">Tekstkleur:</span>
          {TEXT_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              title={c.label}
              onClick={() => {
                editor.chain().focus().setColor(c.value).run();
                setColorPickerOpen(false);
              }}
              className="w-5 h-5 rounded-full border border-line"
              style={{ backgroundColor: c.value }}
            />
          ))}
          <button
            type="button"
            onClick={() => {
              editor.chain().focus().unsetColor().run();
              setColorPickerOpen(false);
            }}
            className="text-xs text-inkSoft hover:underline"
          >
            Standaard
          </button>
        </div>
      )}

      {highlightPickerOpen && (
        <div className="flex items-center gap-2 px-2 py-2 border-b border-line bg-surface">
          <span className="text-xs text-inkSoft">Markeren:</span>
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              title={c.label}
              onClick={() => {
                editor.chain().focus().toggleHighlight({ color: c.value }).run();
                setHighlightPickerOpen(false);
              }}
              className="w-5 h-5 rounded-full border border-line"
              style={{ backgroundColor: c.value }}
            />
          ))}
          <button
            type="button"
            onClick={() => {
              editor.chain().focus().unsetHighlight().run();
              setHighlightPickerOpen(false);
            }}
            className="text-xs text-inkSoft hover:underline"
          >
            Geen
          </button>
        </div>
      )}

      {linkPromptOpen && (
        <form onSubmit={applyLink} className="flex items-center gap-2 px-2 py-2 border-b border-line bg-surface">
          <input
            autoFocus
            type="url"
            placeholder="https://..."
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            className="flex-1 border border-line rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <button type="submit" className="text-sm text-brand font-medium px-2 py-1 hover:underline">
            Toepassen
          </button>
          <button
            type="button"
            onClick={() => setLinkPromptOpen(false)}
            className="text-sm text-inkSoft px-2 py-1 hover:underline"
          >
            Annuleren
          </button>
        </form>
      )}

      {imageError && <div className="px-2 py-1.5 border-b border-line bg-red-50 text-xs text-red-600">{imageError}</div>}

      <EditorContent editor={editor} />
    </div>
  );
}
