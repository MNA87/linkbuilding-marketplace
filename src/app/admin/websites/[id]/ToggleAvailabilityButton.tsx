"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminToggleWebsiteProductAvailabilityAction } from "../actions";

export default function ToggleAvailabilityButton({
  websiteProductId,
  isAvailable,
}: {
  websiteProductId: string;
  isAvailable: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      await adminToggleWebsiteProductAvailabilityAction(websiteProductId);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`text-xs px-3 py-1.5 rounded-md border transition-colors disabled:opacity-60 ${
        isAvailable
          ? "border-line text-inkSoft hover:bg-brandSoft"
          : "border-green-300 text-green-700 hover:bg-green-50"
      }`}
    >
      {isAvailable ? "Zet op inactief" : "Zet op actief"}
    </button>
  );
}
