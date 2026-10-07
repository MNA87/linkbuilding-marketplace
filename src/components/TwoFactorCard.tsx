"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock, ShieldCheck } from "lucide-react";
import {
  confirmTwoFactorAction,
  disableTwoFactorAction,
  newBackupCodesAction,
  startTwoFactorAction,
} from "@/lib/actions/twoFactor";

const codeInput =
  "h-10 w-36 rounded-lg border border-line px-3 text-center font-mono text-base tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-[var(--btn-pay-bg)]";

// Account → Inloggen: tweestapsverificatie with an app on the phone. Off:
// "Aanzetten" shows a QR code to scan and asks for one code; then the
// reservecodes, once. On: turn it off or get new reservecodes, each with a
// current code.
export default function TwoFactorCard({
  enabledAt,
  backupLeft,
  required = false,
}: {
  enabledAt: string | null;
  backupLeft: number;
  required?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [setup, setSetup] = useState<{ qr: string; key: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState("");
  const [manage, setManage] = useState<"off" | "codes" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<void>) =>
    startTransition(async () => {
      setError(null);
      await fn();
    });
  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6);

  // Just turned on, or new ones: the reservecodes, shown this once.
  if (codes) {
    return (
      <div className="space-y-3 text-sm">
        <p className="flex items-center gap-2 font-semibold text-ink">
          <ShieldCheck size={18} className="text-[var(--btn-pay-bg)]" /> Bewaar deze reservecodes
        </p>
        <p className="text-inkSoft">
          Telefoon kwijt? Met elk van deze codes kom je één keer binnen. Print ze of zet ze in je wachtwoordkluis: je
          ziet ze maar één keer.
        </p>
        <div className="grid grid-cols-2 gap-2 font-mono sm:grid-cols-4">
          {codes.map((c) => (
            <span key={c} className="rounded bg-gray-100 px-2 py-1 text-center">
              {c}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            setCodes(null);
            router.refresh();
          }}
          className="btn-pay rounded-lg px-4 py-2 font-semibold"
        >
          Ik heb ze bewaard
        </button>
      </div>
    );
  }

  if (enabledAt) {
    return (
      <div className="space-y-3 text-sm">
        <div className="flex items-start gap-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--pay-soft)] text-[var(--btn-pay-bg)]">
            <ShieldCheck size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">Tweestapsverificatie staat aan.</p>
            <p className="text-inkSoft">
              Sinds {enabledAt} · nog {backupLeft} {backupLeft === 1 ? "reservecode" : "reservecodes"}
            </p>
          </div>
        </div>
        {manage ? (
          <div className="rounded-lg border border-line bg-gray-50/60 p-3">
            <p className="text-inkSoft">
              {manage === "off"
                ? "Vul een code uit je app (of een reservecode) in om tweestapsverificatie uit te zetten."
                : "Vul een code uit je app in voor nieuwe reservecodes. De oude werken daarna niet meer."}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                aria-label="Code"
                autoComplete="one-time-code"
                placeholder="123456"
                className={codeInput}
              />
              <button
                type="button"
                disabled={pending || code.trim().length < 6}
                onClick={() =>
                  run(async () => {
                    if (manage === "off") {
                      const r = await disableTwoFactorAction(code);
                      if (r.error) return setError(r.error);
                      setManage(null);
                      setCode("");
                      router.refresh();
                    } else {
                      const r = await newBackupCodesAction(code);
                      if (r.error || !r.backupCodes) return setError(r.error ?? "Mislukt.");
                      setManage(null);
                      setCode("");
                      setCodes(r.backupCodes);
                    }
                  })
                }
                className={`rounded-lg px-4 py-2 font-semibold disabled:opacity-60 ${
                  manage === "off" ? "bg-red-600 text-white hover:bg-red-700" : "btn-pay"
                }`}
              >
                {pending ? "Bezig..." : manage === "off" ? "Uitzetten" : "Nieuwe codes"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setManage(null);
                  setCode("");
                  setError(null);
                }}
                className="text-inkSoft hover:text-ink"
              >
                Annuleren
              </button>
            </div>
            {required && manage === "off" && (
              <p className="mt-2 text-xs text-amber-700">
                Voor een admin-account is dit verplicht; zet het daarna weer aan.
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              onClick={() => setManage("codes")}
              className="font-medium text-[var(--btn-pay-bg)] hover:underline"
            >
              Nieuwe reservecodes
            </button>
            <button type="button" onClick={() => setManage("off")} className="text-inkSoft hover:text-red-600">
              Uitzetten
            </button>
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  if (setup) {
    return (
      <div className="flex flex-col gap-5 text-sm sm:flex-row">
        {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL, nothing to optimise */}
        <img
          src={setup.qr}
          alt="QR-code voor je authenticator-app"
          className="h-44 w-44 shrink-0 rounded-lg border border-line"
        />
        <ol className="space-y-2.5">
          <li>
            <b>1.</b> Installeer <b>Google Authenticator</b> of <b>Microsoft Authenticator</b> op je telefoon.
          </li>
          <li>
            <b>2.</b> Scan deze QR-code met de app.
            <span className="mt-1 block text-xs text-inkSoft">
              Lukt scannen niet? Vul in de app deze sleutel in: <span className="font-mono text-ink">{setup.key}</span>
            </span>
          </li>
          <li>
            <b>3.</b> Vul de code van 6 cijfers in die de app toont:
          </li>
          <li className="flex flex-wrap items-center gap-2">
            <input
              autoFocus
              value={code}
              onChange={(e) => setCode(digits(e.target.value))}
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-label="Code uit je app"
              placeholder="123456"
              className={codeInput}
            />
            <button
              type="button"
              disabled={pending || code.length !== 6}
              onClick={() =>
                run(async () => {
                  const r = await confirmTwoFactorAction(code);
                  if (r.error || !r.backupCodes) return setError(r.error ?? "Mislukt.");
                  setSetup(null);
                  setCode("");
                  setCodes(r.backupCodes);
                })
              }
              className="btn-pay rounded-lg px-4 py-2 font-semibold disabled:opacity-60"
            >
              {pending ? "Bezig..." : "Aanzetten"}
            </button>
          </li>
          {error && <li className="text-red-600">{error}</li>}
        </ol>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-start gap-3.5 text-sm">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-inkSoft">
        <Lock size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">Tweestapsverificatie staat uit.</p>
        <p className="text-inkSoft">
          Naast je wachtwoord vraagt het platform dan een code van je telefoon. Zelfs met je wachtwoord komt niemand dan
          in je account.
        </p>
        {error && <p className="mt-1 text-red-600">{error}</p>}
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          run(async () => {
            const r = await startTwoFactorAction();
            if (r.error || !r.qr || !r.key) return setError(r.error ?? "Mislukt.");
            setSetup({ qr: r.qr, key: r.key });
          })
        }
        className="btn-pay inline-flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 font-semibold disabled:opacity-60"
      >
        <Check size={15} /> {pending ? "Bezig..." : "Aanzetten"}
      </button>
    </div>
  );
}
