"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useState } from "react";
import { Bold, Italic, Heading2, List, ListOrdered, LinkIcon, Unlink } from "lucide-react";

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

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false, autolink: false }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
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

  const barBtn = (active: boolean) =>
    `p-1.5 rounded-md transition-colors ${active ? "bg-brand text-white" : "text-inkSoft hover:bg-brandSoft hover:text-ink"}`;

  return (
    <div className="border border-line rounded-md focus-within:ring-2 focus-within:ring-brand overflow-hidden">
      <div className="flex items-center gap-1 border-b border-line bg-brandSoft/40 px-2 py-1.5 flex-wrap">
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
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={barBtn(editor.isActive("heading", { level: 2 }))}
          aria-label="Kop"
        >
          <Heading2 size={15} />
        </button>
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
      </div>

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

      <EditorContent editor={editor} />
    </div>
  );
}
