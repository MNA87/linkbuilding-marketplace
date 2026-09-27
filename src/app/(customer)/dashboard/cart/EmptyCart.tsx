import Link from "next/link";
import { ArrowRight, FileText, House } from "lucide-react";

const OFFERS = [
  { type: "BLOG_POST", title: "Blog links", icon: FileText },
  { type: "HOMEPAGE_LINK", title: "Homepage links", icon: House },
] as const;

// An empty cart points straight at what can be bought — the same two
// cards as on the dashboard.
export default function EmptyCart({ sites }: { sites: Record<"BLOG_POST" | "HOMEPAGE_LINK", number> }) {
  return (
    <div>
      <p className="mb-4 text-inkSoft">Je winkelmandje is leeg. Waar wil je een link?</p>
      <div className="grid gap-4 md:grid-cols-2">
        {OFFERS.map(({ type, title, icon: Icon }) => (
          <div key={type} className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-ink/70">
                <Icon size={24} strokeWidth={1.7} />
              </span>
              <h2 className="font-serif text-2xl text-ink sm:text-3xl">{title}</h2>
              <span className="ml-auto shrink-0 rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold tabular-nums text-ink">
                {sites[type].toLocaleString("nl-NL")} {sites[type] === 1 ? "website" : "websites"}
              </span>
            </div>
            <Link
              href={`/marketplace?type=${type}`}
              className="btn-pay mt-5 flex items-center justify-center gap-1.5 rounded-lg px-4 py-3 text-base font-semibold transition"
            >
              Bekijk aanbod <ArrowRight size={16} />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
