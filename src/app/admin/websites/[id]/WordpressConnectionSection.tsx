"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminSetWordpressConnectionAction, adminRemoveWordpressConnectionAction } from "../actions";

export default function WordpressConnectionSection({
  websiteId,
  connected,
  wordpressUrl,
  syncActive,
}: {
  websiteId: string;
  connected: boolean;
  wordpressUrl: string | null;
  syncActive: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(wordpressUrl ?? "");
  const [username, setUsername] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [syncSecret, setSyncSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const inputClass =
    "w-full border border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await adminSetWordpressConnectionAction({
        websiteId,
        wordpressUrl: url,
        wordpressUsername: username,
        wordpressAppPassword: appPassword,
        wpSyncSecret: syncSecret,
      });
      if (!result.success) {
        setError(result.error ?? "Opslaan mislukt.");
        return;
      }
      setEditing(false);
      setAppPassword("");
      setSyncSecret("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove() {
    if (!confirm("WordPress-koppeling verwijderen? Nieuwe orders voor deze site worden dan niet meer automatisch gepubliceerd.")) {
      return;
    }
    setLoading(true);
    try {
      await adminRemoveWordpressConnectionAction(websiteId);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-surface border border-line rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-medium text-ink">WordPress-koppeling</h2>
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            connected ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
          }`}
        >
          {connected ? "Gekoppeld" : "Niet gekoppeld"}
        </span>
      </div>
      <p className="text-sm text-inkSoft mb-3">
        Als dit ingesteld is, publiceert een betaalde order met zelf aangeleverde content automatisch als
        blogpost op deze site.
      </p>

      {connected && !editing && (
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-inkSoft">{wordpressUrl}</span>
            {syncActive && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                WP Sync actief
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditing(true)} className="text-sm text-brand hover:underline">
              Wijzigen
            </button>
            <button onClick={handleRemove} disabled={loading} className="text-sm text-red-600 hover:underline disabled:opacity-60">
              Loskoppelen
            </button>
          </div>
        </div>
      )}

      {!connected && !editing && (
        <button onClick={() => setEditing(true)} className="text-sm text-brand hover:underline">
          Koppelen
        </button>
      )}

      {editing && (
        <form onSubmit={handleSave} className="space-y-3 mt-2">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
          )}
          <div>
            <label className="block text-sm text-ink mb-1">Site-URL</label>
            <input
              placeholder="https://voorbeeld.nl"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="block text-sm text-ink mb-1">WordPress-gebruikersnaam</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} required />
          </div>
          <div>
            <label className="block text-sm text-ink mb-1">Application Password</label>
            <input
              type="password"
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
              className={inputClass}
              placeholder={connected ? "Alleen invullen om te wijzigen" : ""}
              required={!connected}
            />
            <p className="text-xs text-inkSoft mt-1">
              Genereer deze in WordPress bij Gebruikers → Profiel → Application Passwords — niet je gewone
              wachtwoord.
            </p>
          </div>
          <div>
            <label className="block text-sm text-ink mb-1">WP Sync sleutel (optioneel)</label>
            <input
              type="password"
              value={syncSecret}
              onChange={(e) => setSyncSecret(e.target.value)}
              className={inputClass}
              placeholder={syncActive ? "Alleen invullen om te wijzigen" : "Alleen invullen als de sync-plugin actief is"}
            />
            <p className="text-xs text-inkSoft mt-1">
              Blokkeert de hosting van deze site binnenkomende automatische verzoeken (bijv. SiteGround&apos;s
              Anti-Bot Protection)? Installeer dan het bestand{" "}
              <code className="bg-brandSoft/50 px-1 rounded">nugevonden-wp-sync.php</code> als must-use plugin op
              de site — die haalt orders vanaf de site zelf op in plaats van dat wij ernaartoe pushen — en plak
              de sleutel die daar getoond wordt hier.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="bg-brand text-white rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
            >
              {loading ? "Bezig..." : "Opslaan"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="border border-line text-inkSoft rounded-md px-4 py-2 text-sm hover:bg-brandSoft transition-colors"
            >
              Annuleren
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
