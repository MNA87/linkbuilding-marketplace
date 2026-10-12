"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { releasePluginVersionAction, setPluginTestSiteAction } from "./actions";

export type PluginSite = { id: string; domain: string; testSite: boolean; version: string | null; seen: string | null };

// Instellingen → Systeem: the WordPress plugin. A new version goes to the
// test sites first; the rest only get it once it's released here.
export default function PluginReleases({
  latest,
  released,
  sites,
}: {
  latest: string;
  released: string;
  sites: PluginSite[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const pending = latest !== released;
  const testedOn = sites.filter((s) => s.testSite && s.version === latest).map((s) => s.domain);

  async function toggle(site: PluginSite) {
    setBusy(true);
    await setPluginTestSiteAction(site.id, !site.testSite);
    router.refresh();
    setBusy(false);
  }

  async function release() {
    if (!confirm(`Versie ${latest} vrijgeven? Alle sites werken zichzelf dan binnen een paar minuten bij.`)) return;
    setBusy(true);
    setResult(await releasePluginVersionAction(latest));
    router.refresh();
    setBusy(false);
  }

  return (
    <div className="bg-surface border border-line rounded-lg p-4">
      <p className="text-sm font-medium text-ink">WordPress-plugin</p>
      <p className="text-sm text-inkSoft mt-0.5">
        Een nieuwe versie gaat eerst alleen naar de proefsites. Je andere sites krijgen hem pas als je hem hier
        vrijgeeft, zodat een fout nooit al je sites tegelijk raakt.
      </p>

      <div className="mt-3 text-sm text-ink">
        Vrijgegeven voor alle sites: <strong>{released}</strong>
        {pending && (
          <>
            {" "}
            · Nieuwste: <strong>{latest}</strong> (alleen proefsites)
          </>
        )}
      </div>

      {pending && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
          {testedOn.length ? (
            <p className="text-amber-900">
              Draait op {testedOn.join(", ")}. Werkt een bestelling daar goed (artikel online, link terug)? Geef hem dan
              vrij.
            </p>
          ) : (
            <p className="text-amber-900">
              Nog geen proefsite draait {latest}. Die werkt zichzelf binnen een paar minuten bij; test daarna een
              bestelling.
            </p>
          )}
          <button
            type="button"
            onClick={release}
            disabled={busy || !testedOn.length}
            className="mt-2 rounded-md bg-[var(--btn-pay-bg)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Versie {latest} vrijgeven voor alle sites
          </button>
        </div>
      )}
      {result && <p className={`mt-2 text-sm ${result.ok ? "text-emerald-700" : "text-red-700"}`}>{result.message}</p>}

      {sites.length > 0 && (
        <table className="mt-4 w-full text-sm">
          <thead className="text-left text-xs text-inkSoft">
            <tr>
              <th className="py-1.5 font-medium">Site</th>
              <th className="py-1.5 font-medium">Draait</th>
              <th className="py-1.5 font-medium">Proefsite</th>
            </tr>
          </thead>
          <tbody>
            {sites.map((s) => (
              <tr key={s.id} className="border-t border-line/70">
                <td className="py-2 text-ink">{s.domain}</td>
                <td className="py-2 text-inkSoft">
                  {s.version ? `${s.version}${s.seen ? ` · ${s.seen}` : ""}` : "nog onbekend"}
                </td>
                <td className="py-2">
                  <input
                    type="checkbox"
                    checked={s.testSite}
                    disabled={busy}
                    onChange={() => toggle(s)}
                    aria-label={`${s.domain} als proefsite`}
                    className="h-4 w-4 cursor-pointer accent-[var(--btn-pay-bg)]"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
