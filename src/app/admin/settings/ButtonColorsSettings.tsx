"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CreditCard } from "lucide-react";
import { BUTTON_COLOR_PRESETS, buttonColorVars, isHexColor, type ButtonColors } from "@/lib/buttonColors";
import { setButtonColorsAction } from "./actions";

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-sm text-ink mb-1">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="color"
          value={isHexColor(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border border-line bg-surface p-0.5"
        />
        <input
          type="text"
          value={value}
          maxLength={7}
          onChange={(e) => onChange(e.target.value.trim())}
          className={`w-28 border rounded-md px-2 py-1.5 text-sm font-mono ${
            isHexColor(value) ? "border-line" : "border-red-400"
          }`}
        />
      </span>
    </label>
  );
}

export default function ButtonColorsSettings({ initialColors }: { initialColors: ButtonColors }) {
  const router = useRouter();
  const [colors, setColors] = useState<ButtonColors>(initialColors);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const valid = isHexColor(colors.pay) && isHexColor(colors.primary);

  async function save() {
    setLoading(true);
    setMessage(null);
    const result = await setButtonColorsAction(colors);
    setMessage(result.success ? { ok: true, text: "Opgeslagen." } : { ok: false, text: result.error ?? "Opslaan mislukt." });
    if (result.success) router.refresh();
    setLoading(false);
  }

  return (
    <div className="bg-surface border border-line rounded-lg p-4 space-y-4">
      <div>
        <p className="text-sm font-medium text-ink">Knopkleuren</p>
        <p className="text-sm text-inkSoft mt-0.5">
          Hoofdknoppen zijn alle actieknoppen in het systeem (Voeg toe, Opslaan, Inloggen, ...); de betaalknop
          is Afrekenen. De tekstkleur op een knop past zich automatisch aan.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {BUTTON_COLOR_PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            onClick={() => setColors(preset.colors)}
            className="inline-flex items-center gap-2 border border-line rounded-md px-2.5 py-1.5 text-xs text-ink hover:bg-brandSoft"
          >
            <span className="flex">
              <span className="h-3.5 w-3.5 rounded-l" style={{ backgroundColor: preset.colors.primary }} />
              <span className="h-3.5 w-3.5 rounded-r" style={{ backgroundColor: preset.colors.pay }} />
            </span>
            {preset.name}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-6">
        <ColorField label="Betaalknop" value={colors.pay} onChange={(pay) => setColors((c) => ({ ...c, pay }))} />
        <ColorField label="Hoofdknoppen" value={colors.primary} onChange={(primary) => setColors((c) => ({ ...c, primary }))} />
        <div>
          <span className="block text-sm text-ink mb-1">Stijl hoofdknoppen</span>
          <div className="flex gap-3 text-sm h-9 items-center">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={colors.primaryFilled}
                onChange={() => setColors((c) => ({ ...c, primaryFilled: true }))}
              />
              Gevuld
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={!colors.primaryFilled}
                onChange={() => setColors((c) => ({ ...c, primaryFilled: false }))}
              />
              Omlijnd
            </label>
          </div>
        </div>
      </div>

      <div>
        <span className="block text-xs text-inkSoft mb-1.5">Voorbeeld</span>
        <div
          style={buttonColorVars(colors)}
          className="flex flex-wrap items-center justify-end gap-2 border border-dashed border-line rounded-md p-3"
        >
          <span className="inline-flex items-center gap-1 px-2 py-2 text-sm text-inkSoft">
            <ArrowLeft size={16} />
            Terug
          </span>
          <span className="btn-primary rounded-md px-4 py-2 text-sm font-medium">
            Opslaan
          </span>
          <span className="btn-pay inline-flex items-center gap-2 rounded-md px-5 py-2 text-sm font-semibold shadow-sm">
            <CreditCard size={16} />
            Afrekenen
          </span>
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
        {!valid && <p className="text-sm text-red-600">Gebruik een kleurcode als #0d9488.</p>}
        {message && <p className={`text-sm ${message.ok ? "text-emerald-700" : "text-red-600"}`}>{message.text}</p>}
      </div>
    </div>
  );
}
