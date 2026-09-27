"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Check, Circle, Eye, EyeOff } from "lucide-react";
import { PASSWORD_RULES } from "@/lib/validations/auth";
import { inputClass } from "./ui";

// A password field with an eye to show what's typed.
export function PasswordField({
  label,
  children,
  ...input
}: { label: string; children?: React.ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
        <span className="relative block">
          <input {...input} type={visible ? "text" : "password"} className={`${inputClass} pr-11`} />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Wachtwoord verbergen" : "Wachtwoord tonen"}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-inkSoft hover:text-ink"
          >
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </span>
      </label>
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
