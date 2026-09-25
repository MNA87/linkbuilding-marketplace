// The browser's own "Fill out this field" bubbles come in the browser's
// language (often English) — these say the same in Dutch, naming the field.

type Field = Pick<HTMLInputElement, "validity" | "tagName" | "getAttribute"> & {
  labels?: { textContent: string | null }[] | NodeListOf<HTMLLabelElement> | null;
};

function fieldName(field: Field): string {
  const label = field.getAttribute("aria-label") ?? field.labels?.[0]?.textContent ?? "";
  return label.replace(/\s+/g, " ").trim();
}

export function dutchInvalidMessage(field: Field): string {
  const name = fieldName(field);
  if (!name) return "vul alle verplichte velden in.";
  const { validity } = field;
  if (validity.valueMissing) {
    return field.tagName === "SELECT" ? `maak een keuze bij "${name}".` : `vul "${name}" in.`;
  }
  if (validity.typeMismatch) return `"${name}" is geen geldig adres.`;
  if (validity.tooLong) return `"${name}" is te lang.`;
  if (validity.tooShort) return `"${name}" is te kort.`;
  return `controleer "${name}".`;
}

// For a form's onInvalidCapture: skips the browser's bubble, jumps to the
// first field that's wrong and reports it (once per save attempt).
export function reportInvalidInDutch(e: React.FormEvent<HTMLFormElement>, show: (message: string) => void) {
  e.preventDefault();
  const form = e.currentTarget;
  if (form.dataset.invalidReported) return;
  form.dataset.invalidReported = "1";
  setTimeout(() => delete form.dataset.invalidReported, 0);
  const field = e.target as HTMLInputElement;
  field.focus();
  show(`Niet opgeslagen: ${dutchInvalidMessage(field)}`);
}

// The one error message sits at the top of the form; after a click on the
// buttons at the bottom, bring it into view — unless a field that needs
// fixing already got the focus (and so is on screen).
export function showErrorBox(el: HTMLElement | null) {
  const active = document.activeElement;
  if (el && (!active || active === document.body || active.tagName === "BUTTON")) {
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}
