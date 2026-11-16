"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Star } from "lucide-react";

// Het label voor sites die alleen via Publito te boeken zijn (Website.exclusive).
// Warm goud/zand, zodat het opvalt zonder nog meer groen. De uitleg verschijnt
// bij hover/focus (desktop) of bij tikken (telefoon); hij staat "fixed" in de
// body, zodat een tabel met eigen scrollbalk hem niet afknipt.
export default function ExclusiveBadge({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ top: r.bottom + 8, left: Math.max(8, Math.min(r.left - 12, window.innerWidth - 288)) });
  };
  const hide = () => setPos(null);

  // Bij scrollen klopt de plek niet meer: dan verbergen.
  useEffect(() => {
    if (!pos) return;
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, [pos]);

  return (
    <>
      <button
        ref={ref}
        type="button"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={(e) => {
          e.stopPropagation();
          if (pos) hide();
          else show();
        }}
        aria-label="Exclusief: alleen via Publito te boeken"
        className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-[#eadcbf] bg-[#faf5ea] py-0.5 pl-1.5 pr-2 text-[11px] font-bold leading-4 text-[#6b5428] ${className}`}
      >
        <Star size={11} strokeWidth={2.5} className="fill-[#a8771f] text-[#a8771f]" aria-hidden />
        Exclusief
      </button>
      {pos &&
        createPortal(
          <div
            role="tooltip"
            style={{ position: "fixed", top: pos.top, left: pos.left }}
            className="z-[60] w-[270px] rounded-lg bg-[#1f2421] px-3 py-2.5 text-xs leading-relaxed text-white shadow-lg"
          >
            <strong className="block font-semibold">Alleen via Publito</strong>
            Deze site boek je alleen hier. Je vindt hem op geen ander platform.
          </div>,
          document.body
        )}
    </>
  );
}
