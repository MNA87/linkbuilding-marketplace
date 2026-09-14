"use client";

import { useState } from "react";
import { createOrderSchema } from "@/lib/validations/order";
import { createOrderAction } from "./actions";

type Project = { id: string; name: string };

export default function OrderForm({
  websiteProductId,
  price,
  projects,
}: {
  websiteProductId: string;
  price: string;
  projects: Project[];
}) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [newProjectName, setNewProjectName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [anchorText, setAnchorText] = useState("");
  const [comments, setComments] = useState("");
  const [contentSource, setContentSource] = useState<"CUSTOMER" | "PUBLISHER">("PUBLISHER");
  const [articleTitle, setArticleTitle] = useState("");
  const [articleBody, setArticleBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    let uploadedFileUrl = "";
    if (file) {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Uploaden mislukt.");
        return;
      }
      uploadedFileUrl = body.key;
    }

    const input = {
      websiteProductId,
      projectId: projectId || undefined,
      newProjectName: projectId ? undefined : newProjectName,
      targetUrl,
      anchorText,
      comments,
      contentSource,
      articleTitle,
      articleBody,
      uploadedFileUrl,
    };

    const parsed = createOrderSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Ongeldige invoer");
      return;
    }

    setLoading(true);
    try {
      const result = await createOrderAction(input);
      if (result.error || !result.checkoutUrl) {
        setError(result.error ?? "Er ging iets mis.");
        return;
      }
      window.location.href = result.checkoutUrl;
    } catch {
      setError("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full border border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-surface border border-line rounded-lg p-6">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
      )}

      <div>
        <label className="block text-sm text-ink mb-1">Project</label>
        {projects.length > 0 && (
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputClass + " mb-2"}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            <option value="">+ Nieuw project</option>
          </select>
        )}
        {!projectId && (
          <input
            placeholder="Naam van het nieuwe project (bv. je domein)"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            className={inputClass}
            required
          />
        )}
      </div>

      <div>
        <label className="block text-sm text-ink mb-1" htmlFor="targetUrl">
          Doel-URL
        </label>
        <input
          id="targetUrl"
          type="url"
          placeholder="https://jouwsite.nl/pagina"
          required
          value={targetUrl}
          onChange={(e) => setTargetUrl(e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-sm text-ink mb-1" htmlFor="anchorText">
          Ankertekst
        </label>
        <input
          id="anchorText"
          required
          value={anchorText}
          onChange={(e) => setAnchorText(e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-sm text-ink mb-1">Wie levert de content aan?</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setContentSource("PUBLISHER")}
            className={`rounded-md border px-3 py-2 text-sm ${
              contentSource === "PUBLISHER" ? "border-brand bg-brandSoft text-brand" : "border-line text-inkSoft"
            }`}
          >
            De publisher schrijft
          </button>
          <button
            type="button"
            onClick={() => setContentSource("CUSTOMER")}
            className={`rounded-md border px-3 py-2 text-sm ${
              contentSource === "CUSTOMER" ? "border-brand bg-brandSoft text-brand" : "border-line text-inkSoft"
            }`}
          >
            Ik lever zelf aan
          </button>
        </div>
      </div>

      {contentSource === "CUSTOMER" && (
        <>
          <div>
            <label className="block text-sm text-ink mb-1" htmlFor="articleTitle">
              Titel
            </label>
            <input
              id="articleTitle"
              required
              value={articleTitle}
              onChange={(e) => setArticleTitle(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm text-ink mb-1" htmlFor="articleBody">
              Tekst
            </label>
            <textarea
              id="articleBody"
              required
              rows={6}
              value={articleBody}
              onChange={(e) => setArticleBody(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm text-ink mb-1" htmlFor="file">
              Bijlage (optioneel, max 10MB — PDF/Word/afbeelding/tekst)
            </label>
            <input
              id="file"
              type="file"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.txt"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
          </div>
        </>
      )}

      <div>
        <label className="block text-sm text-ink mb-1" htmlFor="comments">
          Opmerkingen (optioneel)
        </label>
        <textarea
          id="comments"
          rows={3}
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-line">
        <div className="text-sm text-inkSoft">
          Totaal: <span className="text-ink font-medium">&euro;{price}</span>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-brand text-white rounded-md px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          {loading ? "Bezig..." : "Doorgaan naar betalen"}
        </button>
      </div>
    </form>
  );
}
