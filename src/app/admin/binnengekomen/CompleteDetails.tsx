"use client";

import { useState } from "react";
import MyDetailsForm, { type DetailsValues } from "@/app/(customer)/dashboard/account/MyDetailsForm";
import type { saveAccountDetailsAction } from "@/app/(customer)/dashboard/account/actions";

// "Gegevens nog niet compleet: aanvullen" on a mail: the customer's details
// card opens right here, so you stay with the mail. Once saved with an
// address the page reloads without it.
export default function CompleteDetails({
  initial,
  save,
}: {
  initial: DetailsValues;
  save: typeof saveAccountDetailsAction;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
      >
        {open ? "Gegevens dichtklappen" : "Gegevens nog niet compleet: aanvullen"}
      </button>
      {open && (
        <div className="mt-3">
          <MyDetailsForm
            initial={initial}
            title="Gegevens van de klant"
            description="Nodig vóór de verzamelfactuur. Ook te zien op de klantpagina."
            emailHint=""
            save={save}
          />
        </div>
      )}
    </div>
  );
}
