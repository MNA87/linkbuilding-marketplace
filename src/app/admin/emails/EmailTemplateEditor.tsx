"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminSetEmailTemplateAction, adminResetEmailTemplateAction } from "./actions";
import type { EmailTemplateKey } from "@/lib/email";
import { emailLayout, type EmailSender } from "@/lib/emailLayout";

export default function EmailTemplateEditor({
  templateKey,
  label,
  description,
  placeholders,
  subject,
  bodyHtml,
  isOverridden,
  sender,
  appUrl,
}: {
  templateKey: EmailTemplateKey;
  label: string;
  description: string;
  placeholders: string[];
  subject: string;
  bodyHtml: string;
  isOverridden: boolean;
  sender: EmailSender;
  appUrl: string;
}) {
  const router = useRouter();
  const [subjectValue, setSubjectValue] = useState(subject);
  const [bodyValue, setBodyValue] = useState(bodyHtml);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(false);

  const inputClass =
    "w-full border border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await adminSetEmailTemplateAction({ key: templateKey, subject: subjectValue, bodyHtml: bodyValue });
      if (!result.success) {
        setError(result.error ?? "Opslaan mislukt.");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    if (!confirm("Terugzetten naar de standaardtekst? Je eigen aanpassingen gaan dan verloren.")) return;
    setLoading(true);
    try {
      await adminResetEmailTemplateAction(templateKey);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-surface border border-line rounded-lg p-4">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-medium text-ink">{label}</h2>
        {isOverridden && (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-brandSoft text-brand">Aangepast</span>
        )}
      </div>
      <p className="text-sm text-inkSoft mb-3">{description}</p>
      <p className="text-xs text-inkSoft mb-3">
        Beschikbare velden:{" "}
        {placeholders.map((p) => (
          <code key={p} className="bg-brandSoft/50 px-1 rounded mr-1">{`{{${p}}}`}</code>
        ))}
      </p>

      <form onSubmit={handleSave} className="space-y-3">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
        )}
        <div>
          <label className="block text-sm text-ink mb-1">Onderwerp</label>
          <input
            value={subjectValue}
            onChange={(e) => setSubjectValue(e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label className="block text-sm text-ink mb-1">Inhoud (HTML)</label>
          <textarea
            value={bodyValue}
            onChange={(e) => setBodyValue(e.target.value)}
            rows={10}
            className={`${inputClass} font-mono text-xs`}
            required
          />
          <p className="mt-1 text-xs text-inkSoft">
            Een groene knop: <code className="bg-brandSoft/50 px-1 rounded">{'<a class="knop" href="...">'}</code> · een
            groen kader: <code className="bg-brandSoft/50 px-1 rounded">{'<div class="kader">'}</code> · kleine grijze
            tekst: <code className="bg-brandSoft/50 px-1 rounded">{'<p class="klein">'}</code>
          </p>
        </div>
        {preview && (
          <iframe
            title={`Voorbeeld: ${label}`}
            sandbox=""
            srcDoc={emailLayout({ body: bodyValue, subject: subjectValue, to: "klant@voorbeeld.nl", sender, appUrl })}
            className="h-[560px] w-full rounded-md border border-line"
          />
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60 transition"
          >
            {loading ? "Bezig..." : "Opslaan"}
          </button>
          <button
            type="button"
            onClick={() => setPreview((p) => !p)}
            className="border border-line text-ink rounded-md px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
          >
            {preview ? "Voorbeeld sluiten" : "Voorbeeld"}
          </button>
          {isOverridden && (
            <button
              type="button"
              onClick={handleReset}
              disabled={loading}
              className="border border-line text-inkSoft rounded-md px-4 py-2 text-sm hover:bg-brandSoft transition-colors disabled:opacity-60"
            >
              Terugzetten naar standaard
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
