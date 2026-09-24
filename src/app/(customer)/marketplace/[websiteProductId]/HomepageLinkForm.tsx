"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addHomepageLinkAction, updateHomepageLinkContentAction } from "./actions";
import FormActions, { wantsToPay } from "./FormActions";
import { goToCheckout } from "../../dashboard/cart/goToCheckout";
import PlacementOptions from "./PlacementOptions";
import { DEFAULT_DURATION_YEARS } from "@/lib/placementPeriod";

type Draft = {
  wpCategoryId: string;
  anchorText: string;
  targetUrl: string;
  nofollow: boolean;
  publishOn: string;
  durationYears: number;
};

const EMPTY_DRAFT: Draft = {
  wpCategoryId: "",
  anchorText: "",
  targetUrl: "",
  nofollow: false,
  publishOn: "",
  durationYears: DEFAULT_DURATION_YEARS,
};

function draftKey(key: string): string {
  return `nugevonden-homepage-link-draft-${key}`;
}

export default function HomepageLinkForm({
  websiteProductId,
  wpCategories,
  orderItemId,
  discardOrderItemId,
  backHref,
  initialDraft,
  yearlyPrice,
  scheduleMin,
  scheduleMax,
}: {
  websiteProductId: string;
  wpCategories: { id: string; name: string }[];
  orderItemId?: string;
  discardOrderItemId?: string;
  backHref: string;
  initialDraft?: Draft;
  yearlyPrice: number;
  scheduleMin: string;
  scheduleMax: string;
}) {
  const router = useRouter();
  const editing = Boolean(orderItemId);
  const storageKey = orderItemId ?? websiteProductId;
  const [draft, setDraft] = useState<Draft>({ ...EMPTY_DRAFT, ...initialDraft });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Same reasoning as OrderForm's own autosave: a local draft (unsaved
  // typing) always wins over what was last actually saved to the server.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(draftKey(storageKey));
      if (saved) setDraft({ ...EMPTY_DRAFT, ...JSON.parse(saved) });
    } catch {
      // Corrupt or inaccessible storage — just start from a blank form.
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(draftKey(storageKey), JSON.stringify(draft));
    } catch {
      // Storage full/blocked — losing autosave isn't worth surfacing an error for.
    }
  }, [draft, storageKey]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function clearDraft() {
    try {
      window.localStorage.removeItem(draftKey(storageKey));
    } catch {
      // Nothing to clean up if storage isn't available.
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pay = wantsToPay(e);
    setError(null);
    setLoading(true);
    try {
      const result = editing
        ? await updateHomepageLinkContentAction({ orderItemId, ...draft })
        : await addHomepageLinkAction({ websiteProductId, ...draft });
      if (!result.success) {
        setError(result.error ?? "Er ging iets mis.");
        setLoading(false);
        return;
      }
      clearDraft();
      if (pay && result.orderId) {
        await goToCheckout(result.orderId, router.push);
      } else {
        router.push("/dashboard/cart");
      }
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
      setLoading(false);
    }
  }

  const inputClass =
    "w-full border border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 items-start lg:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="space-y-4 bg-surface border border-line rounded-lg p-6 min-w-0 lg:col-start-1 lg:row-start-1">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
        )}

        <p className="text-sm text-inkSoft">
          Een homepage-link is een vermelding op de startpagina van deze site — geen artikel, gewoon een linkje met
          ankertekst onder een categorie. Deze gaat direct live zodra je afrekent.
        </p>

        {wpCategories.length > 0 && (
          <div>
            <label className="block text-sm text-ink mb-1" htmlFor="wpCategoryId">
              Categorie
            </label>
            <select
              id="wpCategoryId"
              required
              value={draft.wpCategoryId}
              onChange={(e) => set("wpCategoryId", e.target.value)}
              className={inputClass}
            >
              <option value="" disabled>
                Kies een categorie...
              </option>
              {wpCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm text-ink mb-1" htmlFor="anchorText">
            Ankertekst (de tekst van de link)
          </label>
          <input
            id="anchorText"
            required
            maxLength={200}
            value={draft.anchorText}
            onChange={(e) => set("anchorText", e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm text-ink mb-1" htmlFor="targetUrl">
            Doel-URL
          </label>
          <input
            id="targetUrl"
            type="url"
            required
            placeholder="https://..."
            value={draft.targetUrl}
            onChange={(e) => set("targetUrl", e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm text-ink mb-1">Type link</label>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="nofollow"
                checked={!draft.nofollow}
                onChange={() => set("nofollow", false)}
              />
              Dofollow
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="nofollow"
                checked={draft.nofollow}
                onChange={() => set("nofollow", true)}
              />
              Nofollow
            </label>
          </div>
        </div>
      </div>

      <aside className="bg-surface border border-line rounded-lg p-6 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-4">
        <PlacementOptions
          publishOn={draft.publishOn}
          durationYears={draft.durationYears}
          onPublishOnChange={(value) => set("publishOn", value)}
          onDurationYearsChange={(value) => set("durationYears", value)}
          yearlyPrice={yearlyPrice}
          scheduleMin={scheduleMin}
          scheduleMax={scheduleMax}
          inputClass={inputClass}
        />
      </aside>

      <div className="bg-surface border border-line rounded-lg px-6 py-4 lg:col-start-1 lg:row-start-2">
        <FormActions
          separator={false}
          loading={loading}
          editing={editing}
          discardOrderItemId={discardOrderItemId}
          backHref={backHref}
          hasInput={Boolean(draft.anchorText.trim() || draft.targetUrl.trim())}
          onDiscard={clearDraft}
        />
      </div>
    </form>
  );
}
