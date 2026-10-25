"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Upload, RefreshCw, Trash2 } from "lucide-react";
import PhotoPicker from "@/components/PhotoPicker";

// Kept in sync with src/lib/upload.ts (MAX_IMAGE_SIZE_BYTES). The server
// enforces this too; checking here just saves a pointless upload and gives
// an instant, friendlier error.
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB

// The shared "kies een afbeelding" block, used by both the regular order
// form and the bulk invul-popup so they look and behave the same: one pill
// switch (foto zoeken via Pixabay / eigen foto uploaden), a Pixabay grid, a
// drag-and-drop upload zone, and a calm preview with Vervangen / Verwijderen
// once a photo is chosen. Controlled: `value` is the stored image key ("" =
// none), `onChange` gets the new key (or "" on remove).
export default function ArticleImageField({
  value,
  onChange,
  uploadEnabled = true,
  searchEnabled = true,
  onBusyChange,
}: {
  value: string;
  onChange: (key: string) => void;
  uploadEnabled?: boolean;
  searchEnabled?: boolean;
  // Lets the parent disable its save button while an upload is in flight.
  onBusyChange?: (busy: boolean) => void;
}) {
  const [tab, setTab] = useState<"search" | "upload">(searchEnabled ? "search" : "upload");
  // Once a photo is chosen the picker folds away to the preview; "Vervangen"
  // opens it again.
  const [choosing, setChoosing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onBusyChange?.(uploading);
  }, [uploading, onBusyChange]);

  const previewUrl = value ? `/api/article-images/${value}` : null;
  const bothTabs = uploadEnabled && searchEnabled;
  const showPicker = !previewUrl || choosing;

  function choose(key: string) {
    onChange(key);
    setChoosing(false);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function remove() {
    onChange("");
    setChoosing(false);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function upload(file: File | null | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Afbeelding is te groot (max 2 MB).");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/upload/article-image", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Uploaden van afbeelding mislukt.");
        return;
      }
      choose(body.key);
    } catch {
      setError("Uploaden van afbeelding mislukt. Probeer het opnieuw.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // Nothing to offer and nothing chosen yet: render nothing.
  if (!uploadEnabled && !searchEnabled && !previewUrl) return null;

  const ghostBtn =
    "inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-ink hover:bg-brandSoft transition disabled:opacity-60";

  return (
    <div className="space-y-3">
      {previewUrl && !choosing ? (
        <div className="flex items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt=""
            className="h-[108px] w-40 shrink-0 rounded-lg border border-line object-cover"
          />
          <div className="flex flex-col gap-2 pt-0.5">
            {(uploadEnabled || searchEnabled) && (
              <button type="button" onClick={() => setChoosing(true)} className={ghostBtn}>
                <RefreshCw size={14} /> Vervangen
              </button>
            )}
            <button
              type="button"
              onClick={remove}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-surface px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition"
            >
              <Trash2 size={14} /> Verwijderen
            </button>
          </div>
        </div>
      ) : null}

      {/* Kept mounted (only hidden) once a photo exists so a search term and
          its results survive folding the picker away and back. */}
      <div className={showPicker ? "space-y-3" : "hidden"}>
        {bothTabs && (
          <div className="inline-flex rounded-lg border border-line bg-gray-50 p-0.5">
            <button
              type="button"
              onClick={() => setTab("search")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm transition-colors ${
                tab === "search" ? "bg-surface font-semibold text-ink shadow-sm" : "font-medium text-inkSoft hover:text-ink"
              }`}
            >
              <Search size={14} /> Foto zoeken
            </button>
            <button
              type="button"
              onClick={() => setTab("upload")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm transition-colors ${
                tab === "upload" ? "bg-surface font-semibold text-ink shadow-sm" : "font-medium text-inkSoft hover:text-ink"
              }`}
            >
              <Upload size={14} /> Eigen foto
            </button>
          </div>
        )}

        {searchEnabled && (
          <div className={tab === "search" || !uploadEnabled ? "" : "hidden"}>
            <PhotoPicker onPicked={choose} />
          </div>
        )}

        {uploadEnabled && (
          <div className={tab === "upload" || !searchEnabled ? "" : "hidden"}>
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (!uploading) upload(e.dataTransfer.files?.[0]);
              }}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-7 text-center text-sm transition ${
                dragOver ? "border-brand bg-brandSoft" : "border-line hover:border-brand hover:bg-brandSoft/40"
              } ${uploading ? "cursor-wait opacity-70" : ""}`}
            >
              <span className="mb-2.5 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brandSoft text-brand">
                <Upload size={20} />
              </span>
              {uploading ? (
                <span className="text-inkSoft">Afbeelding uploaden…</span>
              ) : (
                <>
                  <span className="text-inkSoft">
                    Sleep een foto hierheen of <span className="font-semibold text-brand">kies een bestand</span>
                  </span>
                  <span className="mt-1 text-xs text-inkSoft">PNG, JPG, WEBP of GIF · max 2 MB</span>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(e) => upload(e.target.files?.[0])}
                disabled={uploading}
                className="sr-only"
              />
            </label>
          </div>
        )}

        {previewUrl && choosing && (
          <button
            type="button"
            onClick={() => setChoosing(false)}
            className="text-sm text-inkSoft hover:text-ink hover:underline"
          >
            Annuleren — huidige afbeelding houden
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
