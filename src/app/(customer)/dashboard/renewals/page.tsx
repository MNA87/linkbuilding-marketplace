import { redirect } from "next/navigation";

// "Verlengen" is now the "Verloopt binnenkort" tab of Mijn orders.
export default function RenewalsPage() {
  redirect("/dashboard/orders?tab=verloopt");
}
