"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { setLogoAction, removeLogoAction } from "./actions";

// Admin → Instellingen → Kleuren: upload een eigen logo dat de tekst-wordmark
// "Nugevonden" linksboven vervangt. Leeg = terug naar de tekst.
export default function LogoSettings({ currentLogo }: { currentLogo: string }) {
  const router = useRouter();
  const [preview, setPreview] = useState<string>(currentLogo);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setPendingFile(file);
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function onUpload() {
    if (!pendingFile) return;
    setLoading(true);
    setError(null);
    const fd = new FormData();
    fd.set("logo", pendingFile);
    const result = await setLogoAction({ error: null, success: false }, fd);
    if (!result.success) {
      setError(result.error ?? "Uploaden mislukt.");
    } else {
      setPendingFile(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    }
    setLoading(false);
  }

  async function onRemove() {
    setLoading(true);
    setError(null);
    const result = await removeLogoAction();
    if (!result.success) {
      setError(result.error ?? "Verwijderen mislukt.");
    } else {
      setPreview("");
      setPendingFile(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <div className="bg-surface border border-line rounded-lg p-4">
      <p className="text-sm font-medium text-ink">Logo</p>
      <p className="text-sm text-inkSoft mt-0.5">
        Verschijnt linksboven in de app. Zonder logo tonen we de naam &ldquo;Nugevonden&rdquo;. PNG, JPG, WEBP of SVG, max 256KB.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <div className="flex h-14 w-40 shrink-0 items-center justify-center rounded-md border border-line bg-white px-3">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Logo" className="max-h-10 max-w-full object-contain" />
          ) : (
            <span className="font-serif text-ink">Nugevonden</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={onPick}
            aria-label="Logo kiezen"
            className="max-w-[220px] text-sm text-inkSoft file:mr-3 file:rounded-md file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:text-sm file:text-ink hover:file:bg-brandSoft"
          />
          <button
            type="button"
            onClick={onUpload}
            disabled={!pendingFile || loading}
            className="rounded-md border border-line px-3 py-2 text-sm text-ink hover:bg-brandSoft disabled:opacity-50 disabled:hover:bg-transparent"
          >
            {loading ? "Bezig..." : "Opslaan"}
          </button>
          {currentLogo && (
            <button
              type="button"
              onClick={onRemove}
              disabled={loading}
              className="rounded-md border border-line px-3 py-2 text-sm text-inkSoft hover:text-red-600 disabled:opacity-50"
            >
              Verwijderen
            </button>
          )}
        </div>
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
