"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles, X } from "lucide-react";
import RichTextEditor from "@/components/RichTextEditor";
import PhotoPicker from "@/components/PhotoPicker";
import { TITLE_MAX_LENGTH } from "@/lib/validations/order";
import type { BriefLink } from "@/lib/writingService";
import { adminSaveArticleAction, adminWriteArticleAction } from "./actions";

// Same check as missingBriefLinks in lib/articleWriter.ts (server-only file).
function hasLink(html: string, url: string): boolean {
  const target = url.replace(/\/$/, "");
  return Array.from(html.matchAll(/<a\s[^>]*href="([^"]*)"/gi)).some(
    (m) => m[1].replace(/&amp;/g, "&").replace(/\/$/, "") === target
  );
}

// "Laat ons schrijven": the admin writes the article for the customer's
// links — with a first draft from AI if wanted — and saves it; publishing
// then works exactly as for a customer's own article.
export default function WriteArticleForm({
  orderItemId,
  links,
  initialTitle,
  initialBody,
  initialImageKey,
  aiEnabled,
  photoSearchEnabled,
}: {
  orderItemId: string;
  links: BriefLink[];
  initialTitle: string;
  initialBody: string;
  initialImageKey: string;
  aiEnabled: boolean;
  photoSearchEnabled: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [imageKey, setImageKey] = useState(initialImageKey);
  const [choosingImage, setChoosingImage] = useState(!initialImageKey);
  const [writing, setWriting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(Boolean(initialTitle));

  const dirty = title !== initialTitle || body !== initialBody || imageKey !== initialImageKey;
  const hasText = body.replace(/<[^>]*>/g, "").trim().length > 0;

  async function handleWrite() {
    if (hasText && !window.confirm("De huidige tekst wordt vervangen door een nieuwe versie. Doorgaan?")) return;
    setError(null);
    setWriting(true);
    try {
      const result = await adminWriteArticleAction({ orderItemId });
      if (result.error || !result.title || !result.html) {
        setError(result.error ?? "Schrijven mislukt.");
        return;
      }
      setTitle(result.title);
      setBody(result.html);
      setSaved(false);
    } catch {
      setError("Schrijven mislukt. Probeer het opnieuw.");
    } finally {
      setWriting(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const result = await adminSaveArticleAction({
        orderItemId,
        articleTitle: title,
        articleBody: body,
        articleImageKey: imageKey,
      });
      if (!result.success) {
        setError(result.error ?? "Opslaan mislukt.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Opslaan mislukt. Probeer het opnieuw.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full border border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
      )}
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-ink">Artikel</span>
        <button
          type="button"
          onClick={handleWrite}
          disabled={!aiEnabled || writing}
          title={aiEnabled ? undefined : "Zet OPENAI_API_KEY in Railway om dit aan te zetten"}
          className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm text-ink hover:bg-brandSoft disabled:opacity-50 disabled:hover:bg-transparent"
        >
          <Sparkles size={15} />
          {writing ? "AI schrijft… (± 30 sec)" : hasText ? "Opnieuw schrijven met AI" : "Schrijf met AI"}
        </button>
      </div>
      {!aiEnabled && (
        <p className="text-xs text-inkSoft -mt-2">
          AI-schrijven staat uit tot de OpenAI-sleutel (OPENAI_API_KEY) in Railway staat. Zelf schrijven kan wel.
        </p>
      )}

      <div>
        <label className="block text-sm text-ink mb-1" htmlFor="adminArticleTitle">
          Titel
        </label>
        <input
          id="adminArticleTitle"
          required
          maxLength={TITLE_MAX_LENGTH}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
        />
        <div className="mt-1 text-right text-xs text-inkSoft tabular-nums">
          {title.length}/{TITLE_MAX_LENGTH}
        </div>
      </div>

      <div>
        <span className="block text-sm text-ink mb-1">Tekst</span>
        <RichTextEditor value={body} onChange={setBody} />
        <ul className="mt-2 space-y-0.5 text-xs">
          {links.map((l) => {
            const ok = hasLink(body, l.url);
            return (
              <li key={l.url} className={`flex items-center gap-1.5 ${ok ? "text-green-700" : "text-amber-700"}`}>
                {ok ? <Check size={13} /> : <X size={13} />}
                <span>
                  &ldquo;{l.anchor}&rdquo; → {l.url} {ok ? "staat erin" : "staat nog niet in de tekst"}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <span className="block text-sm text-ink mb-1">Afbeelding</span>
        {imageKey && !choosingImage ? (
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/article-images/${imageKey}`}
              alt=""
              className="h-20 w-32 shrink-0 rounded-md border border-line object-cover"
            />
            <div className="flex flex-col items-start gap-1 text-sm">
              <button type="button" onClick={() => setChoosingImage(true)} className="text-brand hover:underline">
                Andere afbeelding kiezen
              </button>
              <button type="button" onClick={() => setImageKey("")} className="text-red-600 hover:underline">
                Verwijderen
              </button>
            </div>
          </div>
        ) : photoSearchEnabled ? (
          <>
            <PhotoPicker
              onPicked={(key) => {
                setImageKey(key);
                setChoosingImage(false);
              }}
            />
            {imageKey && (
              <button
                type="button"
                onClick={() => setChoosingImage(false)}
                className="mt-3 text-sm text-inkSoft hover:text-ink hover:underline"
              >
                Annuleren — huidige afbeelding houden
              </button>
            )}
          </>
        ) : (
          <p className="text-xs text-inkSoft">Foto&apos;s zoeken staat uit (PIXABAY_API_KEY ontbreekt).</p>
        )}
      </div>

      <div className="flex items-center justify-end gap-3">
        {saved && !dirty && <span className="text-xs text-green-700">Opgeslagen</span>}
        {dirty && <span className="text-xs text-inkSoft">Niet opgeslagen wijzigingen</span>}
        <button
          type="submit"
          disabled={saving || writing}
          className="btn-primary rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60 transition"
        >
          {saving ? "Opslaan…" : "Artikel opslaan"}
        </button>
      </div>
    </form>
  );
}
