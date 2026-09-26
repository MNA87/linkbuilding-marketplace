"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, House } from "lucide-react";
import { isHexColor, softColor } from "@/lib/buttonColors";
import { DEFAULT_LINK_TYPE_COLORS, LINK_TYPES, type LinkTypeColors } from "@/lib/linkTypeColors";
import { ColorField } from "./ButtonColorsSettings";
import { setLinkTypeColorsAction } from "./actions";

export default function LinkTypeColorsSettings({ initialColors }: { initialColors: LinkTypeColors }) {
  const router = useRouter();
  const [colors, setColors] = useState<LinkTypeColors>(initialColors);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const valid = LINK_TYPES.every((t) => isHexColor(colors[t.key]));

  async function save() {
    setLoading(true);
    setMessage(null);
    const result = await setLinkTypeColorsAction(colors);
    setMessage(result.success ? { ok: true, text: "Opgeslagen." } : { ok: false, text: result.error ?? "Opslaan mislukt." });
    if (result.success) router.refresh();
    setLoading(false);
  }

  return (
    <div className="bg-surface border border-line rounded-lg p-4 space-y-4">
      <div>
        <p className="text-sm font-medium text-ink">Kleuren per soort link</p>
        <p className="text-sm text-inkSoft mt-0.5">
          Het randje en de icoontjes van blog links en homepage links, op het dashboard en in Mijn orders. De knoppen
          volgen de knopkleuren hierboven.
        </p>
      </div>

      <div className="flex flex-wrap items-start gap-8">
        <div className="space-y-3">
          {LINK_TYPES.map((t) => (
            <ColorField
              key={t.key}
              label={t.label}
              value={colors[t.key]}
              onChange={(value) => setColors((c) => ({ ...c, [t.key]: value }))}
            />
          ))}
          <button
            type="button"
            onClick={() => setColors(DEFAULT_LINK_TYPE_COLORS)}
            className="text-xs text-inkSoft hover:text-ink hover:underline"
          >
            Standaardkleuren terugzetten
          </button>
        </div>

        <div className="space-y-2">
          <span className="block text-xs text-inkSoft">Voorbeeld</span>
          {LINK_TYPES.map((t) => {
            const color = isHexColor(colors[t.key]) ? colors[t.key] : DEFAULT_LINK_TYPE_COLORS[t.key];
            const Icon = t.key === "blog" ? FileText : House;
            return (
              <div key={t.key} className="relative flex w-64 items-center gap-3 overflow-hidden rounded-lg border border-line py-2.5 pl-4 pr-3">
                <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: color }} />
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ backgroundColor: softColor(color), color }}
                >
                  <Icon size={18} />
                </span>
                <span className="text-sm text-ink">{t.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={loading || !valid}
          className="rounded-md border border-brand bg-brand text-white px-3 py-2 text-sm disabled:opacity-60"
        >
          {loading ? "Bezig..." : "Kleuren opslaan"}
        </button>
        {!valid && <p className="text-sm text-red-600">Gebruik een kleurcode als #2563eb.</p>}
        {message && <p className={`text-sm ${message.ok ? "text-emerald-700" : "text-red-600"}`}>{message.text}</p>}
      </div>
    </div>
  );
}
