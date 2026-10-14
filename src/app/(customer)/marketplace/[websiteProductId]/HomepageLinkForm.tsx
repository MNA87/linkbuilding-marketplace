"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addHomepageLinkAction, updateHomepageLinkContentAction } from "./actions";
import FormActions, { wantsToPay } from "./FormActions";
import { goToCheckout } from "../../dashboard/cart/goToCheckout";
import PlacementOptions from "./PlacementOptions";
import { reportInvalidInDutch, showErrorBox } from "@/lib/formValidation";
import { DEFAULT_DURATION_YEARS, durationLabel, sanitizePlacementChoice } from "@/lib/placementPeriod";

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
  siteDomain,
  nextHref,
  initialDraft,
  yearlyPrice,
  periodic,
  scheduleMin,
  scheduleMax,
  nicheOptions = [],
  currentTopicId = "",
  headerDomain,
  productLabel,
  paid = false,
}: {
  websiteProductId: string;
  wpCategories: { id: string; name: string }[];
  nicheOptions?: { id: string; name: string; yearly: number }[];
  currentTopicId?: string;
  headerDomain?: string;
  productLabel?: string;
  orderItemId?: string;
  discardOrderItemId?: string;
  backHref: string;
  // The site's domain, to name it in the "added to cart" confirmation.
  siteDomain: string;
  // Filling in several cart items in a row: where "Opslaan" goes next.
  nextHref?: string;
  initialDraft?: Draft;
  yearlyPrice: number;
  // "Per jaar" on this site: the customer picks 1-3 years.
  periodic: boolean;
  scheduleMin: string;
  scheduleMax: string;
  // Paid for before it was filled in: only the link is sent in now.
  paid?: boolean;
}) {
  const router = useRouter();
  const editing = Boolean(orderItemId);
  const storageKey = orderItemId ?? websiteProductId;
  const [draft, setDraft] = useState<Draft>({ ...EMPTY_DRAFT, ...initialDraft });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Niche prefilled from the marketplace filter; changing it re-prices.
  const [topicId, setTopicId] = useState(currentTopicId);
  const nicheLocked = paid;
  const selectedNiche = nicheOptions.find((n) => n.id === topicId);
  const effYearly = selectedNiche?.yearly ?? yearlyPrice;

  // Same reasoning as OrderForm's own autosave: a local draft (unsaved
  // typing) always wins over what was last actually saved to the server.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(draftKey(storageKey));
      if (saved) {
        const restored = { ...EMPTY_DRAFT, ...JSON.parse(saved) };
        // Everything cleared but never saved (saving an empty link is
        // refused): the saved link is still what counts, so show that.
        const hasLink = (d: Draft) => Boolean(d.anchorText.trim() || d.targetUrl.trim());
        if (!hasLink(restored) && initialDraft && hasLink(initialDraft)) return;
        const placement = sanitizePlacementChoice(restored, { min: scheduleMin, max: scheduleMax });
        setDraft({
          ...restored,
          ...placement,
          // Paid: the period was part of the price.
          durationYears: paid ? (initialDraft?.durationYears ?? placement.durationYears) : placement.durationYears,
        });
      }
    } catch {
      // Corrupt or inaccessible storage — just start from a blank form.
    }
    // Only on opening the form, not on every change of the props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, scheduleMin, scheduleMax]);

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
        ? await updateHomepageLinkContentAction({ orderItemId, topicId, ...draft })
        : await addHomepageLinkAction({ websiteProductId, topicId, ...draft });
      if (!result.success) {
        setError(result.error ?? "Er ging iets mis.");
        setLoading(false);
        return;
      }
      clearDraft();
      if (paid) {
        router.push(nextHref ?? `/dashboard/orders/${result.orderId}?ingevuld=1`);
        router.refresh();
      } else if (pay && result.orderId) {
        await goToCheckout(result.orderId, router.push);
      } else if (nextHref) {
        router.push(nextHref);
        // Refresh so the cart count in the top bar / menu goes up right away.
        router.refresh();
      } else {
        const sep = backHref.includes("?") ? "&" : "?";
        router.push(`${backHref}${sep}toegevoegd=${encodeURIComponent(siteDomain)}`);
        // Refresh so the cart count (top bar / menu) and the row's "in cart"
        // state update immediately, not only after a manual page refresh.
        router.refresh();
      }
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
      setLoading(false);
    }
  }

  const inputClass =
    "w-full border border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";

  return (
    <form
      onSubmit={handleSubmit}
      // A field the browser refuses (e.g. a required one left empty) would
      // otherwise only get a small bubble, or nothing at all if it's out of
      // view — say why nothing was saved, next to the buttons too.
      onInvalidCapture={(e) => reportInvalidInDutch(e, setError)}
      className="space-y-4"
    >
      <div className="space-y-4 bg-surface border border-line rounded-lg p-5 min-w-0">
        {error && (
          <div ref={showErrorBox} className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        {/* Header = facts only: the website + what it is, and the price (black). */}
        <div className="flex items-start justify-between gap-4 border-b border-line pb-4">
          <div className="min-w-0">
            {headerDomain ? (
              <>
                <div className="text-lg font-semibold text-ink">{headerDomain}</div>
                {productLabel && <div className="mt-0.5 text-xs text-inkSoft">{productLabel}</div>}
              </>
            ) : (
              <span />
            )}
          </div>
          <span className="shrink-0 text-xl font-semibold text-ink tabular-nums">
            € {(effYearly * (periodic ? draft.durationYears : 1)).toLocaleString("nl-NL")}
          </span>
        </div>

        {/* Niche changes the price, so it lives with the fields you fill in. */}
        {nicheOptions.length > 0 && (
          <div>
            <label className="block text-sm text-ink mb-1" htmlFor="nicheTopic">
              Niche
            </label>
            <select
              id="nicheTopic"
              value={topicId}
              disabled={nicheLocked}
              onChange={(e) => setTopicId(e.target.value)}
              className={`${inputClass} disabled:bg-gray-100 disabled:text-inkSoft`}
            >
              {nicheOptions.map((n) => (
                <option key={n.id || "algemeen"} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <p className="text-sm text-inkSoft">
          Een homepage-link is een vermelding op de startpagina van deze site — geen artikel, gewoon een linkje met
          ankertekst onder een categorie. Wij controleren hem en zetten hem daarna online.
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

      <div className="bg-surface border border-line rounded-lg p-5">
        <PlacementOptions
          publishOn={draft.publishOn}
          durationYears={draft.durationYears}
          onPublishOnChange={(value) => set("publishOn", value)}
          onDurationYearsChange={(value) => set("durationYears", value)}
          yearlyPrice={effYearly}
          scheduleMin={scheduleMin}
          scheduleMax={scheduleMax}
          inputClass={inputClass}
          directNote={paid ? "Gaat online zodra je hem verstuurt en wij hem hebben gecontroleerd." : undefined}
          // Paid: the period was part of the price.
          showPeriod={periodic && !paid}
        />
        {paid && periodic && (
          <p className="mt-5 pt-4 border-t border-line flex justify-between text-sm text-ink">
            <span>Periode</span>
            <span>{durationLabel(draft.durationYears)} · betaald</span>
          </p>
        )}
      </div>

      <div className="bg-surface border border-line rounded-lg px-5 py-4">
        <FormActions
          separator={false}
          loading={loading}
          editing={editing}
          discardOrderItemId={discardOrderItemId}
          nextInSequence={Boolean(nextHref)}
          paid={paid}
          backHref={backHref}
          hasInput={Boolean(draft.anchorText.trim() || draft.targetUrl.trim())}
          onDiscard={clearDraft}
        />
      </div>
    </form>
  );
}
