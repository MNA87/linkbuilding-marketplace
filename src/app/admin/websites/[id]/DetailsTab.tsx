"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminSaveWebsiteDetailsAction } from "../actions";
import { DetailsFields, SaveBar, type DetailsState, type Option } from "../WebsiteFields";

// Tab "Gegevens": everything about the site and its placement, one Opslaan.
export default function DetailsTab({
  websiteId,
  initial,
  countries,
  languages,
  niches: initialNiches,
}: {
  websiteId: string;
  initial: DetailsState;
  countries: Option[];
  languages: Option[];
  niches: Option[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [niches, setNiches] = useState(initialNiches);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = JSON.stringify(value) !== JSON.stringify(saved);

  return (
    <div>
      <DetailsFields
        value={value}
        onChange={(v) => {
          setValue(v);
          setMessage(null);
        }}
        countries={countries}
        languages={languages}
        niches={niches}
        onNicheCreated={(n) => setNiches((list) => (list.some((x) => x.id === n.id) ? list : [...list, n]))}
      />
      <SaveBar
        dirty={dirty}
        pending={pending}
        message={message}
        onSave={() =>
          startTransition(async () => {
            const r = await adminSaveWebsiteDetailsAction(websiteId, value);
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
