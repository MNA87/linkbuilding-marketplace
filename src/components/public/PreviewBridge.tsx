"use client";

import { useEffect } from "react";

// Alleen actief in het live voorbeeld binnen de editor (?cms=preview, admin).
// Laat zien welk blok onder de muis zit, meldt een klik aan de editor en
// scrollt naar een blok als de editor daarom vraagt. Links doen hier niets,
// zodat je niet per ongeluk uit het voorbeeld navigeert.
export default function PreviewBridge() {
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      [data-cms-block]{outline:2px solid transparent;outline-offset:-2px;transition:outline-color .12s;cursor:pointer}
      [data-cms-block]:hover{outline-color:#93c5fd}
      [data-cms-block][data-cms-active="1"]{outline-color:#2563eb}
      [data-cms-block][data-cms-active="1"]::before{content:attr(data-cms-label);position:absolute;left:12px;top:-11px;z-index:5;
        font:600 11px/1 Inter,system-ui,sans-serif;color:#1d4ed8;background:#dbeafe;border-radius:4px;padding:4px 7px}
      [data-cms-block] a, [data-cms-block] button{pointer-events:none}
    `;
    document.head.appendChild(style);

    const blockOf = (el: EventTarget | null) => (el instanceof Element ? el.closest<HTMLElement>("[data-cms-block]") : null);
    const setActive = (id: string | null) => {
      document.querySelectorAll<HTMLElement>("[data-cms-block]").forEach((el) => {
        if (el.dataset.cmsBlock === id) el.dataset.cmsActive = "1";
        else delete el.dataset.cmsActive;
      });
    };

    const onClick = (e: MouseEvent) => {
      const el = blockOf(e.target);
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      setActive(el.dataset.cmsBlock ?? null);
      window.parent?.postMessage({ type: "cms:select", block: el.dataset.cmsBlock }, window.location.origin);
    };
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || !e.data || typeof e.data !== "object") return;
      if (e.data.type === "cms:highlight") {
        const id = typeof e.data.block === "string" ? e.data.block : null;
        setActive(id);
        if (id) {
          const el = document.querySelector<HTMLElement>(`[data-cms-block="${CSS.escape(id)}"]`);
          el?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
      if (e.data.type === "cms:labels" && e.data.labels && typeof e.data.labels === "object") {
        const labels = e.data.labels as Record<string, string>;
        document.querySelectorAll<HTMLElement>("[data-cms-block]").forEach((el) => {
          const l = labels[el.dataset.cmsBlock ?? ""];
          if (l) el.dataset.cmsLabel = l;
        });
      }
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("message", onMessage);
    window.parent?.postMessage({ type: "cms:ready" }, window.location.origin);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("message", onMessage);
      style.remove();
    };
  }, []);
  return null;
}
