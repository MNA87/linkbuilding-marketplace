"use client";

import { useState } from "react";
import { Search } from "lucide-react";

type Photo = { id: number; thumbUrl: string; alt: string; photographer: string; pageUrl: string };

export default function PhotoPicker({ onPicked }: { onPicked: (key: string) => void }) {
  const [term, setTerm] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [page, setPage] = useState(1);
  const [totalHits, setTotalHits] = useState(0);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [pickingId, setPickingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search(nextPage: number) {
    if (term.trim().length < 2) {
      setError("Typ minimaal 2 tekens.");
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/photos/search?q=${encodeURIComponent(term.trim())}&page=${nextPage}`);
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Zoeken lukte niet.");
        return;
      }
      setPhotos((prev) => (nextPage === 1 ? body.photos : [...prev, ...body.photos]));
      setTotalHits(body.totalHits);
      setPage(nextPage);
      setSearched(true);
    } catch {
      setError("Zoeken lukte niet. Probeer het opnieuw.");
    } finally {
      setSearching(false);
    }
  }

  async function pick(photo: Photo) {
    setPickingId(photo.id);
    setError(null);
    try {
      const res = await fetch("/api/photos/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: photo.id }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Deze foto kon niet worden toegevoegd.");
        return;
      }
      onPicked(body.key);
    } catch {
      setError("Deze foto kon niet worden toegevoegd. Probeer het opnieuw.");
    } finally {
      setPickingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          // Enter must search here, not submit the whole order form.
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              search(1);
            }
          }}
          placeholder="Bijv. energie, tuin, kantoor..."
          maxLength={100}
          className="flex-1 border border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <button
          type="button"
          onClick={() => search(1)}
          disabled={searching}
          className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-brandSoft disabled:opacity-60 transition"
        >
          <Search size={16} />
          {searching && page === 1 ? "Zoeken..." : "Zoeken"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {searched && photos.length === 0 && !error && (
        <p className="text-sm text-inkSoft">Geen foto&apos;s gevonden. Probeer een ander (of Engels) zoekwoord.</p>
      )}

      {photos.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {photos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => pick(photo)}
                disabled={pickingId !== null}
                title={photo.alt || `Foto van ${photo.photographer}`}
                className="relative aspect-[4/3] overflow-hidden rounded-md border border-line hover:ring-2 hover:ring-brand focus:outline-none focus:ring-2 focus:ring-brand disabled:cursor-wait"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.thumbUrl} alt={photo.alt} loading="lazy" className="h-full w-full object-cover" />
                {pickingId === photo.id && (
                  <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-xs font-medium text-ink">
                    Toevoegen...
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between text-xs text-inkSoft">
            <a href="https://pixabay.com/" target="_blank" rel="noopener noreferrer" className="hover:underline">
              Foto&apos;s van Pixabay
            </a>
            {photos.length < totalHits && (
              <button
                type="button"
                onClick={() => search(page + 1)}
                disabled={searching}
                className="text-brand hover:underline disabled:opacity-60"
              >
                {searching ? "Laden..." : "Meer foto's"}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
