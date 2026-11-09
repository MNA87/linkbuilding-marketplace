"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { createPostAction, deletePostAction } from "./actions";

export function NewPostButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await createPostAction();
            if ("ok" in r && r.ok === false) setError(r.error);
            else router.push(`/admin/site/blog/${(r as { id: string }).id}`);
          })
        }
        className="inline-flex items-center gap-2 rounded-md bg-[var(--btn-pay-bg)] px-3.5 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50"
      >
        <Plus size={15} /> {pending ? "Bezig…" : "Nieuw bericht"}
      </button>
      {error && <span className="text-sm text-red-700">{error}</span>}
    </>
  );
}

export function DeletePostLink({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(`"${title || "Dit bericht"}" definitief verwijderen?`)) return;
        start(async () => {
          const r = await deletePostAction(id);
          if (r.ok) router.refresh();
          else alert(r.error);
        });
      }}
      className="text-red-700 hover:underline disabled:opacity-50"
    >
      {pending ? "Bezig…" : "Verwijderen"}
    </button>
  );
}
