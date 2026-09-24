const COLORS: Record<string, string> = {
  NEW: "bg-gray-100 text-gray-700",
  PAID: "bg-blue-100 text-blue-700",
  SENT_TO_PUBLISHER: "bg-blue-100 text-blue-700",
  ACCEPTED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  PUBLISHED: "bg-green-100 text-green-700",
  VERIFICATION: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  CANCELLED: "bg-red-100 text-red-700",
  REFUND_REQUESTED: "bg-red-100 text-red-700",
};

const LABELS: Record<string, string> = {
  NEW: "Nieuw",
  PAID: "Betaald",
  SENT_TO_PUBLISHER: "Doorgestuurd",
  ACCEPTED: "Geaccepteerd",
  IN_PROGRESS: "In behandeling",
  PUBLISHED: "Gepubliceerd",
  VERIFICATION: "Wordt gecontroleerd",
  COMPLETED: "Afgerond",
  REJECTED: "Afgewezen",
  CANCELLED: "Geannuleerd",
  REFUND_REQUESTED: "Annulering aangevraagd",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${COLORS[status] ?? "bg-gray-100 text-gray-700"}`}>
      {LABELS[status] ?? status}
    </span>
  );
}
