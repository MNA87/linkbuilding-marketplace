"use client";

import { useId, useState, type InputHTMLAttributes } from "react";
import { Check, Circle, Eye, EyeOff } from "lucide-react";
import { PASSWORD_RULES } from "@/lib/validations/auth";
import { inputClass } from "@/app/(customer)/dashboard/account/ui";

// A password field with an eye to show what's typed.
//
// The eye button is a SIBLING of the <label>, not a child of it: a <button>
// nested inside a <label> is a cross-browser footgun — iPad Safari forwards a
// tap on it to the labelled input (focus) instead of firing the button, so the
// eye "does nothing" there. The label is tied to the input with htmlFor
// instead, so tapping the label still focuses the field.
export function PasswordField({
  label,
  children,
  ...input
}: { label: string; children?: React.ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  const autoId = useId();
  const id = input.id ?? autoId;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        <input {...input} id={id} type={visible ? "text" : "password"} className={`${inputClass} pr-11`} />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Wachtwoord verbergen" : "Wachtwoord tonen"}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-inkSoft hover:text-ink"
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {children}
    </div>
  );
}

// Under a new password: each requirement turns green once it's met.
export function PasswordRules({ value }: { value: string }) {
  return (
    <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs" aria-label="Eisen aan je wachtwoord">
      {PASSWORD_RULES.map((r) => {
        const met = r.test(value);
        return (
          <li key={r.label} className={`flex items-center gap-1.5 ${met ? "text-emerald-700" : "text-inkSoft"}`}>
            {met ? <Check size={13} strokeWidth={3} /> : <Circle size={11} />}
            {r.label}
          </li>
        );
      })}
    </ul>
  );
}
