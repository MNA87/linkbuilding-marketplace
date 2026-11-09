"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import type { MediaItem } from "@/lib/cms/media";
import { listMediaAction, uploadMediaAction } from "./actions";

// Kiezen of uploaden van een afbeelding, als venster boven de editor.
export default function MediaPicker({ onSelect, onClose }: { onSelect: (m: MediaItem) => void; onClose: () => void }) {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listMediaAction().then(setItems);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      const r = await uploadMediaAction(fd);
      if ("ok" in r && r.ok === false) {
        setError(r.error);
        continue;
      }
      const item = r as MediaItem;
      setItems((prev) => [item, ...(prev ?? [])]);
      if (files.length === 1) {
        setBusy(false);
        onSelect(item);
        return;
      }
    }
    setBusy(false);
  };

  const shown = (items ?? []).filter((m) => !q || m.filename.toLowerCase().includes(q.toLowerCase()) || m.alt.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-line px-5 py-3">
          <h3 className="text-[15px] font-semibold">Afbeelding kiezen</h3>
          <input
            className="ml-2 w-56 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-[var(--btn-pay-bg)]"
            placeholder="Zoeken…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <span className="flex-1" />
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--btn-pay-bg)] px-3.5 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50"
          >
            <Upload size={15} /> {busy ? "Bezig…" : "Uploaden"}
          </button>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-gray-500 hover:bg-gray-100" title="Sluiten">
            <X size={17} />
          </button>
        </div>
        {error && <div className="border-b border-red-200 bg-red-50 px-5 py-2 text-sm text-red-800">{error}</div>}
        <div
          className="min-h-[240px] flex-1 overflow-y-auto p-5"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            upload(e.dataTransfer.files);
          }}
        >
          {items === null ? (
            <p className="text-sm text-inkSoft">Laden…</p>
          ) : shown.length === 0 ? (
            <div className="grid h-full place-items-center rounded-xl border-2 border-dashed border-gray-200 p-10 text-center text-sm text-inkSoft">
              <div>
                <Upload className="mx-auto mb-2 text-gray-400" size={22} />
                Sleep hier een afbeelding naartoe of klik op <b>Uploaden</b>.
                <div className="mt-1 text-xs">PNG, JPG, WEBP of GIF, max 8 MB. Grote foto's worden automatisch verkleind.</div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
              {shown.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onSelect(m)}
                  className="group overflow-hidden rounded-lg border border-line bg-gray-50 text-left hover:border-[var(--btn-pay-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--pay-soft)]"
                  title={m.filename}
                >
                  <div className="aspect-[4/3] bg-[#f3f4f3]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.url} alt={m.alt} className="h-full w-full object-cover" loading="lazy" />
                  </div>
                  <div className="truncate px-2 py-1.5 text-[11.5px] text-gray-600">{m.filename}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
