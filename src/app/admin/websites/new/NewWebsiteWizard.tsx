"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminCreateWebsiteAction } from "../actions";
import {
  DetailsFields,
  PricesTable,
  card,
  type DetailsState,
  type Option,
  type PriceColumnState,
} from "../WebsiteFields";

const STEPS = ["Gegevens", "Prijzen"] as const;

// "Nieuwe website" in two steps — the same two tabs a site has afterwards —
// so everything the marketplace overview needs is filled in at once.
export default function NewWebsiteWizard({
  initialDetails,
  initialPrices,
  countries,
  languages,
  niches: initialNiches,
  topics,
}: {
  initialDetails: DetailsState;
  initialPrices: PriceColumnState[];
  countries: Option[];
  languages: Option[];
  niches: Option[];
  topics: Option[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [details, setDetails] = useState(initialDetails);
  const [prices, setPrices] = useState(initialPrices);
  const [niches, setNiches] = useState(initialNiches);
  const [error, setError] = useState<string | null>(null);

  // What has to be there before going on to the prices.
  const firstStepError = !details.domain.trim()
    ? "Vul het domein in."
    : !details.countryId
      ? "Kies een land."
      : !details.languageId
        ? "Kies een taal."
        : details.nicheIds.length === 0
          ? "Kies minstens één niche."
          : null;

  const next = () => {
    if (firstStepError) return setError(firstStepError);
    setError(null);
    setStep(1);
    window.scrollTo({ top: 0 });
  };
  const create = () =>
    startTransition(async () => {
      setError(null);
      const r = await adminCreateWebsiteAction({ details, prices });
      if (r.error || !r.id) {
        setError(r.error ?? "Er ging iets mis.");
        // A problem with the details: back to where it can be fixed.
        if (r.error && !/prijs|product/i.test(r.error)) setStep(0);
        return;
      }
      router.push(`/admin/websites/${r.id}?tab=prijzen`);
      router.refresh();
    });

  return (
    <div>
      <ol className="mt-5 flex items-center gap-3">
        {STEPS.map((name, i) => (
          <li key={name} className="flex items-center gap-3">
            {i > 0 && <span className="h-px w-8 bg-line" />}
            <button
              type="button"
              onClick={() => (i === 0 ? setStep(0) : next())}
              className="flex items-center gap-2"
              aria-current={i === step ? "step" : undefined}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  i <= step ? "bg-[var(--btn-pay-bg)] text-white" : "bg-gray-100 text-inkSoft"
                }`}
              >
                {i + 1}
              </span>
              <span className={`text-sm ${i === step ? "font-semibold text-ink" : "text-inkSoft"}`}>{name}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-5">
        {step === 0 ? (
          <DetailsFields
            value={details}
            onChange={(v) => {
              setDetails(v);
              setError(null);
            }}
            countries={countries}
            languages={languages}
            niches={niches}
            onNicheCreated={(n) => setNiches((list) => (list.some((x) => x.id === n.id) ? list : [...list, n]))}
          />
        ) : (
          <section className={`${card} overflow-hidden`}>
            <div className="px-5 pb-4 pt-5">
              <h2 className="font-semibold text-ink">Prijzen per onderwerp</h2>
              <p className="text-sm text-inkSoft">
                Vink aan wat deze site aanbiedt. Leeg = dit onderwerp wordt hier niet geplaatst. Prijzen excl. btw.
              </p>
            </div>
            <PricesTable
              value={prices}
              onChange={(v) => {
                setPrices(v);
                setError(null);
              }}
              topics={topics}
            />
          </section>
        )}
      </div>

      <div className="sticky bottom-0 z-10 mt-5 flex flex-wrap items-center justify-end gap-3 rounded-xl border border-line bg-surface px-5 py-3">
        {error && <span className="mr-auto text-sm text-red-600">{error}</span>}
        {step === 0 ? (
          <>
            <button
              type="button"
              onClick={() => router.push("/admin/websites")}
              className="rounded-lg border border-line px-5 py-2 text-sm text-inkSoft hover:bg-gray-50"
            >
              Annuleren
            </button>
            <button type="button" onClick={next} className="btn-pay rounded-lg px-5 py-2 text-sm font-semibold">
              Volgende: Prijzen →
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setStep(0)}
              className="rounded-lg border border-line px-5 py-2 text-sm text-inkSoft hover:bg-gray-50"
            >
              ← Gegevens
            </button>
            <button
              type="button"
              onClick={create}
              disabled={pending}
              className="btn-pay rounded-lg px-5 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {pending ? "Bezig..." : "Website toevoegen"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
