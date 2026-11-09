"use client";

import { useRef, useState } from "react";
import { Copy, Trash2, Upload } from "lucide-react";
import type { MediaItem } from "@/lib/cms/media";
import { deleteMediaAction, mediaUsageAction, updateMediaAltAction, uploadMediaAction } from "./actions";

const fmtSize = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} kB`);
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Amsterdam" });

export default function MediaLibrary({ initial }: { initial: MediaItem[] }) {
  const [items, setItems] = useState(initial);
  const [sel, setSel] = useState<MediaItem | null>(null);
  const [usage, setUsage] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [alt, setAlt] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const select = async (m: MediaItem) => {
    setSel(m);
    setAlt(m.alt);
    setUsage(null);
    setUsage(await mediaUsageAction(m.id));
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setMsg(null);
    let added = 0;
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      const r = await uploadMediaAction(fd);
      if ("ok" in r && r.ok === false) setMsg({ kind: "err", text: r.error });
      else {
        setItems((prev) => [r as MediaItem, ...prev]);
        added++;
      }
    }
    setBusy(false);
    if (added) setMsg({ kind: "ok", text: `${added} afbeelding${added === 1 ? "" : "en"} geüpload.` });
  };

  const saveAlt = async () => {
    if (!sel) return;
    const r = await updateMediaAltAction(sel.id, alt);
    if (r.ok) {
      setItems((prev) => prev.map((m) => (m.id === sel.id ? { ...m, alt } : m)));
      setSel({ ...sel, alt });
      setMsg({ kind: "ok", text: "Alt-tekst opgeslagen." });
    } else setMsg({ kind: "err", text: r.error });
  };

  const remove = async () => {
    if (!sel || !confirm(`"${sel.filename}" definitief verwijderen?`)) return;
    const r = await deleteMediaAction(sel.id);
    if (r.ok) {
      setItems((prev) => prev.filter((m) => m.id !== sel.id));
      setSel(null);
      setMsg({ kind: "ok", text: "Verwijderd." });
    } else setMsg({ kind: "err", text: r.error });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-md bg-[var(--btn-pay-bg)] px-3.5 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50"
          >
            <Upload size={15} /> {busy ? "Bezig…" : "Uploaden"}
          </button>
          <span className="text-sm text-inkSoft">{items.length} bestand{items.length === 1 ? "" : "en"}</span>
          {msg && <span className={`text-sm ${msg.kind === "ok" ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</span>}
        </div>
        <div
          className="mt-4 min-h-[260px] rounded-xl border border-line bg-surface p-4"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            upload(e.dataTransfer.files);
          }}
        >
          {items.length === 0 ? (
            <div className="grid h-[220px] place-items-center rounded-lg border-2 border-dashed border-gray-200 text-center text-sm text-inkSoft">
              <div>
                <Upload className="mx-auto mb-2 text-gray-400" size={22} />
                Sleep hier afbeeldingen naartoe of klik op <b>Uploaden</b>.
                <div className="mt-1 text-xs">PNG, JPG, WEBP of GIF, max 8 MB. Grote foto's worden automatisch verkleind.</div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-6">
              {items.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => select(m)}
                  className={`overflow-hidden rounded-lg border bg-gray-50 text-left hover:border-[var(--btn-pay-bg)] ${sel?.id === m.id ? "border-[var(--btn-pay-bg)] ring-2 ring-[var(--pay-soft)]" : "border-line"}`}
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

      <aside className="rounded-xl border border-line bg-surface p-4">
        {!sel ? (
          <p className="text-sm text-inkSoft">Klik op een afbeelding voor de details.</p>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sel.url} alt={sel.alt} className="w-full rounded-lg border border-line bg-[#f3f4f3]" />
            <div className="mt-3 break-all text-sm font-semibold">{sel.filename}</div>
            <div className="mt-1 text-xs text-inkSoft">
              {sel.width && sel.height ? `${sel.width} × ${sel.height} px · ` : ""}
              {fmtSize(sel.size)} · {fmtDate(sel.createdAt)}
            </div>
            <label className="mt-4 block text-xs font-semibold text-gray-700">Alt-tekst (voor Google en schermlezers)</label>
            <textarea className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[var(--btn-pay-bg)]" rows={2} value={alt} onChange={(e) => setAlt(e.target.value)} />
            <button type="button" onClick={saveAlt} className="mt-2 rounded-md border border-line bg-white px-3 py-1.5 text-sm font-semibold hover:bg-gray-50">
              Alt-tekst opslaan
            </button>
            <div className="mt-4 flex items-center gap-2 text-xs text-inkSoft">
              <code className="truncate rounded bg-gray-100 px-2 py-1">{sel.url}</code>
              <button
                type="button"
                title="Adres kopiëren"
                onClick={() => navigator.clipboard?.writeText(window.location.origin + sel.url).catch(() => undefined)}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md hover:bg-gray-100"
              >
                <Copy size={14} />
              </button>
            </div>
            <div className="mt-4 text-xs text-inkSoft">
              {usage === null ? "Gebruik controleren…" : usage.length ? `Gebruikt in: ${usage.join(", ")}` : "Nergens in gebruik."}
            </div>
            <button
              type="button"
              onClick={remove}
              disabled={!usage || usage.length > 0}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-red-700 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 size={14} /> Verwijderen
            </button>
          </>
        )}
      </aside>
    </div>
  );
}
