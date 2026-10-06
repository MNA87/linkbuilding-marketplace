"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminSavePricesAction } from "../actions";
import { PricesTable, SaveBar, card, type Option, type PriceColumnState } from "../WebsiteFields";

// Tab "Prijzen": per product whether it's offered, its "Duur" and a price
// per topic.
export default function PricesTab({
  websiteId,
  initial,
  topics,
}: {
  websiteId: string;
  initial: PriceColumnState[];
  topics: Option[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = JSON.stringify(value) !== JSON.stringify(saved);

  return (
    <div>
      <section className={`${card} overflow-hidden`}>
        <div className="px-5 pb-4 pt-5">
          <h2 className="font-semibold text-ink">Prijzen per onderwerp</h2>
          <p className="text-sm text-inkSoft">
            Leeg = dit onderwerp wordt op deze site niet geplaatst. Prijzen excl. btw. Onderwerpen beheer je onder
            Instellingen → Stamdata.
          </p>
        </div>
        <PricesTable
          value={value}
          onChange={(v) => {
            setValue(v);
            setMessage(null);
          }}
          topics={topics}
        />
      </section>
      <SaveBar
        dirty={dirty}
        pending={pending}
        message={message}
        onSave={() =>
          startTransition(async () => {
            const r = await adminSavePricesAction(websiteId, value);
            if (r.error) return setMessage({ ok: false, text: r.error });
            setSaved(value);
            setMessage({ ok: true, text: "Opgeslagen." });
            router.refresh();
          })
        }
      />
    </div>
  );
}
