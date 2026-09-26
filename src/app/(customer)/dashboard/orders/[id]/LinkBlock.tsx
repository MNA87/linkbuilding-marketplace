"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

// One link of an order: its header line always visible, the article (and
// renewing) folded away until clicked. `focus` opens it and scrolls to it —
// for links that point at this one link (?link=…).
export default function LinkBlock({
  id,
  header,
  children,
  defaultOpen,
  focus,
}: {
  id: string;
  header: React.ReactNode;
  children?: React.ReactNode;
  defaultOpen: boolean;
  focus: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen || focus);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focus) ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focus]);

  return (
    <div id={`link-${id}`} ref={ref} className="scroll-mt-6 overflow-hidden rounded-xl border border-line">
      <div
        className={`flex items-center gap-3 px-4 py-3 ${children ? "cursor-pointer hover:bg-gray-50/70" : ""}`}
        onClick={(e) => {
          // The header opens and closes the block too — except its own links.
          if (children && !(e.target as HTMLElement).closest("a, button")) setOpen((o) => !o);
        }}
      >
        <div className="min-w-0 flex-1">{header}</div>
        {children && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? "Inklappen" : "Openklappen"}
            className="shrink-0 rounded-md p-1 text-inkSoft hover:bg-gray-100 hover:text-ink"
          >
            <ChevronDown size={18} className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>
      {open && children && <div className="border-t border-line/70 bg-gray-50/50 px-4 py-4">{children}</div>}
    </div>
  );
}
