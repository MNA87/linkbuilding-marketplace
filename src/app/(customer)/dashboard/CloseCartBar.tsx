"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { hideCartBarAction } from "./actions";

export default function CloseCartBar() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await hideCartBarAction();
          router.refresh();
        })
      }
      aria-label="Melding sluiten"
      title="Sluiten"
      className="absolute right-2 top-2 rounded-md p-1 text-amber-700/70 hover:bg-amber-100 hover:text-amber-900 sm:static sm:-mr-2"
    >
      <X size={16} />
    </button>
  );
}
