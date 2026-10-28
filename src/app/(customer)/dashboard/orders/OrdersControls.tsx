"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import ProjectFilter from "./ProjectFilter";

// Zoeken + een project-dropdown (alleen bij bureaus met projecten).
// Status-tabs (Lopend/Live/Alle) staan eronder; de lijst is nieuwste-eerst.
export default function OrdersControls({
  projects,
  noneCount,
  projectValue,
}: {
  projects: { id: string; name: string; count: number }[];
  noneCount: number;
  projectValue: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const get = (key: string) => searchParams.get(key) ?? "";

  const search = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    params.delete("pagina");
    const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
    if (q) params.set("q", q);
    else params.delete("q");
    const query = params.toString();
    router.push(query ? `/dashboard/orders?${query}` : "/dashboard/orders");
  };

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2.5">
      <form
        className="flex h-10 min-w-[200px] flex-1 overflow-hidden rounded-lg border border-line bg-surface focus-within:ring-2 focus-within:ring-[var(--btn-pay-bg)]"
        onSubmit={search}
      >
        <span className="flex items-center pl-3 text-inkSoft/80">
          <Search size={16} />
        </span>
        <input
          key={get("q")}
          name="q"
          type="search"
          aria-label="Zoek op website of ordernummer"
          defaultValue={get("q")}
          placeholder="Zoek op website of ordernummer"
          className="min-w-0 flex-1 bg-transparent px-3 text-sm text-ink placeholder:text-inkSoft/80 focus:outline-none"
        />
      </form>

      {projects.length > 0 && <ProjectFilter projects={projects} noneCount={noneCount} value={projectValue} />}
    </div>
  );
}
