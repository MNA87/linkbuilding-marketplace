"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setStatusAction } from "../actions";

// "Offline halen" / "Publiceren" in het paginaoverzicht.
export default function StatusToggle({ slug, status, canUnpublish }: { slug: string; status: "published" | "draft"; canUnpublish: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (status === "published" && !canUnpublish) return null;
  const next = status === "published" ? "draft" : "published";
  return (
    <span className="text-xs">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await setStatusAction(slug, next);
            if (!r.ok) setError(r.error);
            else router.refresh();
          })
        }
        className={`hover:underline disabled:opacity-50 ${next === "draft" ? "text-red-700" : "text-[var(--btn-pay-bg)]"}`}
      >
        {pending ? "Bezig…" : next === "draft" ? "Offline halen" : "Publiceren"}
      </button>
      {error && <span className="ml-2 text-red-700">{error}</span>}
    </span>
  );
}
