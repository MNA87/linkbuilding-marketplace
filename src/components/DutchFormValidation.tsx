"use client";

import { useEffect } from "react";
import { dutchInvalidMessage } from "@/lib/formValidation";

type Checkable = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function isCheckable(el: EventTarget | null): el is Checkable {
  return el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement;
}

// Site-wide: the browser's own bubble for a field left empty ("Fill out this
// field") follows the browser's language, often English. This gives every
// form's bubble the Dutch text instead, and lets go of it as soon as the
// field is touched again. The order forms show it in their own error box.
export default function DutchFormValidation() {
  useEffect(() => {
    function onInvalid(e: Event) {
      const field = e.target;
      if (!isCheckable(field)) return;
      field.setCustomValidity("");
      if (field.validity.valid) return;
      const message = dutchInvalidMessage(field);
      field.setCustomValidity(message.charAt(0).toUpperCase() + message.slice(1));
    }
    function onEdit(e: Event) {
      if (isCheckable(e.target)) e.target.setCustomValidity("");
    }
    document.addEventListener("invalid", onInvalid, true);
    document.addEventListener("input", onEdit, true);
    document.addEventListener("change", onEdit, true);
    return () => {
      document.removeEventListener("invalid", onInvalid, true);
      document.removeEventListener("input", onEdit, true);
      document.removeEventListener("change", onEdit, true);
    };
  }, []);
  return null;
}
