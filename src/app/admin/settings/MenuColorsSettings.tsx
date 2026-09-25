"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isHexColor } from "@/lib/buttonColors";
import {
  DEFAULT_MENU_COLORS,
  MENU_GROUPS,
  type MenuColors,
} from "@/lib/menuColors";
import { ColorField } from "./ButtonColorsSettings";
import { setMenuColorsAction } from "./actions";

const PREVIEW_ITEMS: Record<keyof MenuColors, string[]> = {
  buy: ["Blog links", "Homepage links"],
  manage: ["Mijn orders", "Mijn links"],
  admin: ["Winkelmandje", "Facturen"],
};

export default function MenuColorsSettings({
  initialColors,
}: {
  initialColors: MenuColors;
}) {
  const router = useRouter();
  const [colors, setColors] = useState<MenuColors>(initialColors);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  const valid = MENU_GROUPS.every((g) => isHexColor(colors[g.key]));

  async function save() {
    setLoading(true);
    setMessage(null);
    const result = await setMenuColorsAction(colors);
    setMessage(
      result.success
        ? { ok: true, text: "Opgeslagen." }
        : { ok: false, text: result.error ?? "Opslaan mislukt." },
    );
    if (result.success) router.refresh();
    setLoading(false);
  }

  return (
    <div className="bg-surface border border-line rounded-lg p-4 space-y-4">
      <div>
        <p className="text-sm font-medium text-ink">Menukleuren</p>
        <p className="text-sm text-inkSoft mt-0.5">
          De kleur van de kopjes in het menu van klanten.
        </p>
      </div>

      <div className="flex flex-wrap items-start gap-8">
        <div className="space-y-3">
          {MENU_GROUPS.map((g) => (
            <ColorField
              key={g.key}
              label={g.label}
              value={colors[g.key]}
              onChange={(value) => setColors((c) => ({ ...c, [g.key]: value }))}
            />
          ))}
          <button
            type="button"
            onClick={() => setColors(DEFAULT_MENU_COLORS)}
            className="text-xs text-inkSoft hover:text-ink hover:underline"
          >
            Standaardkleuren terugzetten
          </button>
        </div>

        <div>
          <span className="block text-xs text-inkSoft mb-1.5">Voorbeeld</span>
          <div className="w-52 border border-dashed border-line rounded-md px-2 pb-3">
            {MENU_GROUPS.map((g) => {
              const color = isHexColor(colors[g.key])
                ? colors[g.key]
                : DEFAULT_MENU_COLORS[g.key];
              return (
                <div key={g.key}>
                  <div
                    className="flex items-center gap-2 px-2 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    {g.label}
                  </div>
                  {PREVIEW_ITEMS[g.key].map((label) => (
                    <div key={label} className="px-2 py-1 text-sm text-ink/80">
                      {label}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
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
        {!valid && (
          <p className="text-sm text-red-600">
            Gebruik een kleurcode als #2563eb.
          </p>
        )}
        {message && (
          <p
            className={`text-sm ${message.ok ? "text-emerald-700" : "text-red-600"}`}
          >
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}
