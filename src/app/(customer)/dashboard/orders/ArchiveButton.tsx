"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore } from "lucide-react";
import { setOrderArchivedAction } from "./actions";

// Archiveer- of herstel-knop op een order-rij in Mijn orders. Zit boven de
// rij-link (z-10) en stopt de klik, zodat archiveren niet per ongeluk de
// order opent.
export default function ArchiveButton({ orderId, archived }: { orderId: string; archived: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      aria-label={archived ? "Order terugzetten" : "Order archiveren"}
      title={error ? "Lukte niet — probeer opnieuw" : archived ? "Terugzetten" : "Archiveren"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setError(false);
        startTransition(async () => {
          const res = await setOrderArchivedAction(orderId, !archived).catch(() => null);
          if (!res || res.error) {
            setError(true);
            return;
          }
          router.refresh();
        });
      }}
      className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border transition-colors disabled:opacity-50 ${
        error
          ? "border-red-300 bg-red-50 text-red-600"
          : "border-line bg-surface text-inkSoft hover:border-[var(--btn-pay-bg)] hover:bg-[var(--pay-soft)] hover:text-[var(--btn-pay-bg)]"
      }`}
    >
      {archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
    </button>
  );
}
