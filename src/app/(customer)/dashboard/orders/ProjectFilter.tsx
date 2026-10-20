"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Folder } from "lucide-react";

// Compacte project-filter als dropdown — voor als er veel projecten zijn (de
// losse chips zouden dan een muur worden, zeker op mobiel). Houdt de overige
// filters in de url vast en begint weer op pagina 1.
export default function ProjectFilter({
  projects,
  noneCount,
  value,
}: {
  projects: { id: string; name: string; count: number }[];
  noneCount: number;
  value: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const onChange = (v: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("pagina");
    if (v) params.set("project", v);
    else params.delete("project");
    const query = params.toString();
    router.push(query ? `/dashboard/orders?${query}` : "/dashboard/orders");
  };

  return (
    <label className="relative inline-flex w-full items-center sm:w-auto">
      <span className="sr-only">Filter op project</span>
      <Folder size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--btn-pay-bg)]" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full appearance-none rounded-lg border border-line bg-surface pl-9 pr-9 text-sm font-medium text-ink focus:outline-none focus:ring-2 focus:ring-brand sm:w-auto sm:min-w-[220px]"
      >
        <option value="">Alle projecten</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} ({p.count})
          </option>
        ))}
        {noneCount > 0 && <option value="none">Geen project ({noneCount})</option>}
      </select>
      <ChevronDown size={15} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-inkSoft" />
    </label>
  );
}
