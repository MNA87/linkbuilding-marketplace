import { redirect } from "next/navigation";

// "Mijn links" is now part of Mijn orders.
export default function CustomerLinksPage() {
  redirect("/dashboard/orders?tab=live");
}
