import ReconcileButton from "./ReconcileButton";

export default function AdminReconcilePage() {
  return (
    <div className="max-w-lg">
      <h1 className="font-serif text-2xl text-ink mb-1">Betalingen controleren</h1>
      <p className="text-sm text-inkSoft mb-6">
        Controleert orders die langer dan 15 minuten op &quot;betaling in behandeling&quot; staan rechtstreeks bij
        Stripe — voor het geval een webhook een keer niet is aangekomen.
      </p>
      <ReconcileButton />
    </div>
  );
}
