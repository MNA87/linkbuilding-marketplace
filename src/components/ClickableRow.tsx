"use client";

import { useRouter } from "next/navigation";

// A table row that opens `href` wherever it's tapped, like the rows on the
// computer. A link inside it (the live link, a reaction) still goes where
// it points; the row's own links keep it reachable by keyboard.
export default function ClickableRow({
  href,
  className = "",
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <tr
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a, button, input")) return;
        router.push(href);
      }}
      className={`cursor-pointer active:[&>td]:bg-gray-50 ${className}`}
    >
      {children}
    </tr>
  );
}
