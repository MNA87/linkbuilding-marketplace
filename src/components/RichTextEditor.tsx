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
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  RemoveFormatting,
  SeparatorHorizontal,
  Undo2,
  Redo2,
  List,
  ListOrdered,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignRight,
  LinkIcon,
  Unlink,
  Table as TableIcon,
  Palette,
  Highlighter,
} from "lucide-react";

type BlockType = "p" | "h2" | "h3";

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
  const linkInputRef = useRef<HTMLInputElement>(null);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [highlightPickerOpen, setHighlightPickerOpen] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    // Re-render on every change, including just moving the cursor, so the
    // toolbar (active buttons, the heading dropdown) always matches where
    // the cursor is.
    shouldRerenderOnTransaction: true,
    extensions: [
      // No H1: the article title is already the page's H1 on the site, and a
      // second one in the body hurts SEO. A pasted H1 becomes a paragraph.
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false, autolink: false }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
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

  // This component is always used inside another <form> (the order form),
  // so the editor's own content must stay in sync when its `value` prop
  // changes from OUTSIDE a keystroke here — e.g. a draft restored from
  // localStorage after a refresh. Tiptap only reads `content` once, at
  // creation, so without this the restored text would show in every plain
  // input but never in the rich text body itself.
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  // The input is always in the DOM (only hidden via CSS, via the "hidden"
  // class below, never unmounted) so it's a real, focusable element the
  // moment this fires. Focusing it right inside openLinkPrompt() below
  // doesn't work: at that point in the click handler the div still carries
  // last render's "hidden" class (React hasn't committed the state update
  // yet), and a display:none element can't receive focus at all — the
  // call silently no-ops. useLayoutEffect runs after React has already
  // applied the DOM update (div now visible) but before the browser
  // paints, which is early enough to still count as part of the tap's
  // "user activation" window on mobile — so the on-screen keyboard
  // actually pops open, instead of leaving the field there but untappable.
  useLayoutEffect(() => {
    if (linkPromptOpen) linkInputRef.current?.focus();
  }, [linkPromptOpen]);

  if (!editor) return null;

  const blockType: BlockType = editor.isActive("heading", { level: 2 })
    ? "h2"
    : editor.isActive("heading", { level: 3 })
      ? "h3"
      : "p";

  function setBlockType(type: BlockType) {
    const chain = editor!.chain().focus();
    if (type === "p") chain.setParagraph().run();
    else chain.setHeading({ level: type === "h2" ? 2 : 3 }).run();
  }

  function openLinkPrompt() {
    setColorPickerOpen(false);
    setHighlightPickerOpen(false);
    setLinkUrl(editor!.getAttributes("link").href ?? "");
    setLinkPromptOpen(true);
  }

  // Deliberately not a <form> — this editor is always rendered inside the
  // order form's own <form>, and a nested <form> is invalid HTML: the
  // browser silently restructures the DOM around it, which is what made
  // clicking "Toepassen" appear to wipe the whole page instead of just
  // applying the link.
  function applyLink() {
    if (linkUrl.trim()) {
      editor!.chain().focus().extendMarkRange("link").setLink({ href: linkUrl.trim() }).run();
    }
    setLinkPromptOpen(false);
    setLinkUrl("");
  }

  const barBtn = (active: boolean) =>
    `p-1.5 rounded-md transition-colors ${active ? "bg-brand text-white" : "text-inkSoft hover:bg-brandSoft hover:text-ink"}`;

  return (
    <div className="border border-line rounded-md focus-within:ring-2 focus-within:ring-brand overflow-hidden">
      <div className="flex items-center gap-1 border-b border-line bg-brandSoft/40 px-2 py-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className={`${barBtn(false)} disabled:opacity-40`}
          aria-label="Ongedaan maken" title="Ongedaan maken"
        >
          <Undo2 size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className={`${barBtn(false)} disabled:opacity-40`}
          aria-label="Opnieuw" title="Opnieuw"
        >
          <Redo2 size={15} />
        </button>
        <div className="w-px h-4 bg-line mx-1" />
        <select
          value={blockType}
          onChange={(e) => setBlockType(e.target.value as BlockType)}
          aria-label="Tekststijl" title="Tekststijl"
          className="text-sm text-ink bg-surface border border-line rounded-md px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-brand"
        >
          <option value="p">Paragraaf</option>
          <option value="h2">Kop 2</option>
          <option value="h3">Kop 3</option>
        </select>
        <div className="w-px h-4 bg-line mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={barBtn(editor.isActive("bold"))}
          aria-label="Vet" title="Vet"
        >
          <Bold size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={barBtn(editor.isActive("italic"))}
          aria-label="Cursief" title="Cursief"
        >
          <Italic size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={barBtn(editor.isActive("underline"))}
          aria-label="Onderstrepen" title="Onderstrepen"
        >
          <UnderlineIcon size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={barBtn(editor.isActive("strike"))}
          aria-label="Doorhalen" title="Doorhalen"
        >
          <Strikethrough size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          className={barBtn(false)}
          aria-label="Opmaak wissen" title="Opmaak wissen"
        >
          <RemoveFormatting size={15} />
        </button>
        <div className="w-px h-4 bg-line mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={barBtn(editor.isActive("bulletList"))}
          aria-label="Opsomming" title="Opsomming"
        >
          <List size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={barBtn(editor.isActive("orderedList"))}
          aria-label="Genummerde lijst" title="Genummerde lijst"
        >
          <ListOrdered size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={barBtn(editor.isActive("blockquote"))}
          aria-label="Citaat" title="Citaat"
        >
          <Quote size={15} />
        </button>
        <div className="w-px h-4 bg-line mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          className={barBtn(editor.isActive({ textAlign: "left" }))}
          aria-label="Links uitlijnen" title="Links uitlijnen"
        >
          <AlignLeft size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          className={barBtn(editor.isActive({ textAlign: "center" }))}
          aria-label="Centreren" title="Centreren"
        >
          <AlignCenter size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          className={barBtn(editor.isActive({ textAlign: "right" }))}
          aria-label="Rechts uitlijnen" title="Rechts uitlijnen"
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
          aria-label="Tekstkleur" title="Tekstkleur"
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
          aria-label="Markeren" title="Markeren"
        >
          <Highlighter size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className={barBtn(false)}
          aria-label="Horizontale lijn" title="Horizontale lijn"
        >
          <SeparatorHorizontal size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          className={barBtn(false)}
          aria-label="Tabel invoegen" title="Tabel invoegen"
        >
          <TableIcon size={15} />
        </button>
        <div className="w-px h-4 bg-line mx-1" />
        <button type="button" onClick={openLinkPrompt} className={barBtn(editor.isActive("link"))} aria-label="Link invoegen" title="Link invoegen">
          <LinkIcon size={15} />
        </button>
        {editor.isActive("link") && (
          <button
            type="button"
            onClick={() => editor.chain().focus().unsetLink().run()}
            className={barBtn(false)}
            aria-label="Link verwijderen" title="Link verwijderen"
          >
            <Unlink size={15} />
          </button>
        )}
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

      <div
        className={`flex items-center gap-2 px-2 py-2 border-b border-line bg-surface ${linkPromptOpen ? "" : "hidden"}`}
      >
        <input
          ref={linkInputRef}
          type="url"
          placeholder="https://..."
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              applyLink();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setLinkPromptOpen(false);
            }
          }}
          className="flex-1 border border-line rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <button type="button" onClick={applyLink} className="text-sm text-brand font-medium px-2 py-1 hover:underline">
          Toepassen
        </button>
        <button
          type="button"
          onClick={() => setLinkPromptOpen(false)}
          className="text-sm text-inkSoft px-2 py-1 hover:underline"
        >
          Annuleren
        </button>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}
